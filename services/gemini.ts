import { GenerationSettings } from "../types";

// Resizes a base64 or source image URL to the exact custom dimensions using an off-screen HTML canvas.
const resizeBase64Image = (imageUrl: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png", 0.95));
      } else {
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
};

export const generateImage = async (settings: GenerationSettings): Promise<{ 
  imageUrl: string; 
  text?: string;
  effectivePrompt?: string;
  sourceImagesCount?: number;
}> => {
  let response: Response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
  } catch (netErr: any) {
    throw new Error(netErr?.message || "Network error while connecting to generation service.");
  }

  const contentType = response.headers.get("content-type") || "";

  // If the server returned HTML (e.g., warmup page or proxy error)
  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    if (
      rawText.trim().startsWith("<") || 
      rawText.toLowerCase().includes("<!doctype") || 
      rawText.toLowerCase().includes("<html")
    ) {
      throw new Error("Server is initializing or reloading. Please wait a moment and try again.");
    }
    throw new Error(rawText.slice(0, 300) || `Server returned non-JSON response (${response.status})`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Unable to parse server response. Please try again.");
  }

  if (!response.ok) {
    let errorMsg = data?.error || `Server error (${response.status})`;
    if (typeof errorMsg === "string" && errorMsg.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {}
    }
    throw new Error(errorMsg);
  }

  let imageUrl = data.imageUrl;
  const text = data.text;

  if (settings.aspectRatio === "custom" && settings.customDimensions) {
    const { width, height } = settings.customDimensions;
    if (width > 0 && height > 0) {
      try {
        imageUrl = await resizeBase64Image(imageUrl, width, height);
      } catch (err) {
        console.error("Canvas resize error, using raw model output:", err);
      }
    }
  }

  return { 
    imageUrl, 
    text,
    effectivePrompt: data.effectivePrompt,
    sourceImagesCount: data.sourceImagesCount,
  };
};
