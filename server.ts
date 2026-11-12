import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required. Please set your API key in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support up to 50mb payload for image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Image Generation API endpoint
  app.post("/api/generate", async (req: Request, res: Response) => {
    try {
      const settings = req.body;
      if (!settings || !settings.prompt) {
        res.status(400).json({ error: "A prompt is required." });
        return;
      }

      const ai = getGeminiClient();

      let effectiveModel = settings.model || "gemini-3.1-flash-lite-image";
      if (effectiveModel === "gemini-2.5-flash-image") {
        effectiveModel = "gemini-3.1-flash-lite-image";
      } else if (
        effectiveModel === "imagen-4.0-generate-001" || 
        effectiveModel === "imagen-3.0-generate-002" || 
        (typeof effectiveModel === "string" && effectiveModel.startsWith("imagen"))
      ) {
        effectiveModel = "gemini-3.1-flash-image";
      }

      let finalAspectRatio = settings.aspectRatio || "1:1";
      let finalImageSize = settings.imageSize || "1K";

      // If custom aspect ratio is selected, map to closest supported
      if (settings.aspectRatio === "custom" && settings.customDimensions) {
        const w = settings.customDimensions.width || 2200;
        const h = settings.customDimensions.height || 2200;
        const targetRatio = w / h;
        const supportedRatios = [
          { name: "1:1", value: 1.0 },
          { name: "3:4", value: 0.75 },
          { name: "4:3", value: 1.3333 },
          { name: "9:16", value: 0.5625 },
          { name: "16:9", value: 1.7777 },
        ];

        const closest = supportedRatios.reduce((prev, curr) =>
          Math.abs(curr.value - targetRatio) < Math.abs(prev.value - targetRatio) ? curr : prev
        );
        finalAspectRatio = closest.name;

        const maxDim = Math.max(w, h);
        if (maxDim <= 512) {
          finalImageSize = "512px";
        } else if (maxDim <= 1024) {
          finalImageSize = "1K";
        } else if (maxDim <= 2048) {
          finalImageSize = "2K";
        } else {
          finalImageSize = "4K";
        }

        if (
          (effectiveModel === "gemini-3-pro-image-preview" || effectiveModel === "gemini-3-pro-image") &&
          finalImageSize === "512px"
        ) {
          finalImageSize = "1K";
        }
      }

      // Determine safety filter threshold (defaults to BLOCK_NONE for minimal false-positive blocking)
      let threshold = HarmBlockThreshold.BLOCK_NONE;
      if (settings.safetyFilter === "block_only_high") {
        threshold = HarmBlockThreshold.BLOCK_ONLY_HIGH;
      } else if (settings.safetyFilter === "block_medium_and_above") {
        threshold = HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
      }

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold },
      ];

      // Handle Gemini series models
      const config: any = {
        imageConfig: {
          aspectRatio: finalAspectRatio,
        },
        safetySettings,
      };

      const supportsImageSize = [
        "gemini-3-pro-image",
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-image",
        "gemini-3.1-flash-image-preview",
      ].includes(effectiveModel);

      if (supportsImageSize) {
        config.imageConfig.imageSize = finalImageSize;
      }

      const parts: any[] = [];
      const guidelines: string[] = [];

      if (settings.sourceImages && settings.sourceImages.length > 0) {
        settings.sourceImages.forEach((img: any, idx: number) => {
          parts.push({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType || "image/png",
            },
          });
          const refNum = idx + 1;
          const role = img.role || "style";
          const strength = img.strength || "balanced"; // subtle (25%), balanced (50%), strong (75%), exact (100%)
          const custom = img.customInstruction?.trim();

          let directive = "";
          if (role === "custom" && custom) {
            if (strength === "subtle") {
              directive = `Lightly take inspiration from Reference #${refNum}: ${custom}. Do not overfit.`;
            } else if (strength === "strong") {
              directive = `Strongly adhere to Reference #${refNum}: ${custom}. Ensure high fidelity to this requirement.`;
            } else if (strength === "exact") {
              directive = `Strict requirement from Reference #${refNum}: ${custom}. Replicate exactly without alteration.`;
            } else {
              directive = `Follow directive from Reference #${refNum}: ${custom}.`;
            }
          } else if (role === "character") {
            if (strength === "subtle") {
              directive = `Lightly evoke the character traits or likeness from Reference #${refNum}.`;
            } else if (strength === "strong") {
              directive = `Faithfully preserve the exact facial structure, recognizable features, hair, and identity from Reference #${refNum}.`;
            } else if (strength === "exact") {
              directive = `Strict identity clone: Replicate the precise face, identity, clothing, and likeness from Reference #${refNum} with zero deviation.`;
            } else {
              directive = `Keep the facial structure, identity, and character features from Reference #${refNum}.`;
            }
          } else if (role === "subject") { // Layout / Composition
            if (strength === "subtle") {
              directive = `Loosely reference the framing or spatial balance of Reference #${refNum}.`;
            } else if (strength === "strong") {
              directive = `Closely match the scene composition, camera angle, framing, and object placement of Reference #${refNum}.`;
            } else if (strength === "exact") {
              directive = `Strict layout lock: Replicate the exact camera angle, perspective, positioning, and framing from Reference #${refNum}.`;
            } else {
              directive = `Adopt the scene layout, composition, perspective, and framing from Reference #${refNum}.`;
            }
          } else { // Style / Aesthetic
            if (strength === "subtle") {
              directive = `Subtly borrow the general mood, lighting nuance, or color accents from Reference #${refNum}.`;
            } else if (strength === "strong") {
              directive = `Strongly replicate the visual medium, tactile material texture, surface weave, color grading, and artistic lighting from Reference #${refNum}.`;
            } else if (strength === "exact") {
              directive = `Exact texture & style clone: Rigorously reproduce the exact tactile surface, grain, weave texture, color palette, and medium from Reference #${refNum}.`;
            } else {
              directive = `Apply the aesthetic properties, tactile texture, color grading, and lighting style from Reference #${refNum}.`;
            }
          }

          if (custom && role !== "custom") {
            directive += ` Additional note: "${custom}".`;
          }

          guidelines.push(`- Reference Image #${refNum} (${role.toUpperCase()}, ${strength.toUpperCase()} weight): ${directive}`);
        });
      }

      let finalPrompt = settings.prompt;
      if (guidelines.length > 0) {
        finalPrompt += `\n\n[Multimodal Reference Steering Guidelines]:\n${guidelines.join("\n")}`;
      }

      if (settings.negativePrompt?.trim()) {
        finalPrompt += `\n\n[Negative Constraints / Do Not Include]:\n${settings.negativePrompt.trim()}`;
      }

      parts.push({ text: finalPrompt });

      const response = await ai.models.generateContent({
        model: effectiveModel,
        contents: {
          parts: parts,
        },
        config,
      });

      let imageUrl = "";
      let text = "";

      const responseParts = response.candidates?.[0]?.content?.parts;
      if (responseParts) {
        for (const part of responseParts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          } else if (part.text) {
            text += part.text;
          }
        }
      }

      if (!imageUrl) {
        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const finishMessage = candidate?.finishMessage;
        const safetyRatings = candidate?.safetyRatings || response.promptFeedback?.safetyRatings || [];

        const flaggedDetails: string[] = [];
        if (Array.isArray(safetyRatings) && safetyRatings.length > 0) {
          const nonNegligible = safetyRatings
            .filter((r) => {
              const probStr = String(r.probability || "").toUpperCase();
              return r.blocked || (probStr && !probStr.includes("NEGLIGIBLE") && !probStr.includes("UNSPECIFIED"));
            })
            .map((r) => {
              const cat = (r.category || "").replace("HARM_CATEGORY_", "").replace(/_/g, " ").toLowerCase();
              const sub: string[] = [];
              const probStr = String(r.probability || "").replace("HARM_PROBABILITY_", "");
              const sevStr = String(r.severity || "").replace("HARM_SEVERITY_", "");
              if (probStr && !probStr.includes("NEGLIGIBLE")) sub.push(`prob: ${probStr.toLowerCase()}`);
              if (sevStr && !sevStr.includes("NEGLIGIBLE")) sub.push(`sev: ${sevStr.toLowerCase()}`);
              if (r.blocked) sub.push("BLOCKED");
              return `${cat} (${sub.join(", ") || "flagged"})`;
            });
          if (nonNegligible.length > 0) {
            flaggedDetails.push(`Ratings: ${nonNegligible.join("; ")}`);
          }
        }
        if (finishMessage) {
          flaggedDetails.push(`Model note: ${finishMessage}`);
        }
        if (response.promptFeedback?.blockReason) {
          flaggedDetails.push(`Prompt block: ${response.promptFeedback.blockReason}`);
        }

        const ratingSuffix = flaggedDetails.length > 0 ? ` [${flaggedDetails.join(" | ")}]` : "";

        if (finishReason === "PROHIBITED_CONTENT") {
          throw new Error(
            `Generation stopped by model (Reason: PROHIBITED_CONTENT).${ratingSuffix} ` +
            "The prompt or reference images triggered Google's generative text/content policy. " +
            "Set the Content Safety Filter to 'Relaxed (BLOCK_NONE)' in the sidebar, or rephrase sensitive or ambiguous terms in your prompt."
          );
        } else if (finishReason === "IMAGE_SAFETY") {
          throw new Error(
            `Generation stopped by model (Reason: IMAGE_SAFETY).${ratingSuffix} ` +
            "Google's visual output safety classifier halted the generated image. " +
            "Note: The visual safety classifier runs directly on the generated pixel output and is non-bypassable by design (even with the 'Relaxed / BLOCK_NONE' prompt safety toggle). " +
            "It is typically triggered by: perceived skin exposure or swimwear, real-person likenesses, weapons, or stylized gore/violence. " +
            "Try: adding clothing descriptions (e.g. 'fully clothed, streetwear'), switching to an illustrative/concept art style, removing human reference photos, or switching models."
          );
        } else if (finishReason && finishReason !== "STOP") {
          throw new Error(`Generation stopped by model (Reason: ${finishReason}).${ratingSuffix}`);
        }
        throw new Error("No image was returned by the model. Please adjust your prompt and try again.");
      }

      res.json({ 
        imageUrl, 
        text,
        effectivePrompt: finalPrompt,
        sourceImagesCount: settings.sourceImages?.length || 0,
      });
    } catch (err: any) {
      console.error("Image generation error:", err);
      let errorMessage = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
      try {
        if (typeof errorMessage === "string" && errorMessage.trim().startsWith("{")) {
          const parsed = JSON.parse(errorMessage);
          if (parsed?.error?.message) {
            errorMessage = parsed.error.message;
          }
        }
      } catch {
        // Fallback to original message
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
