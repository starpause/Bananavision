
import React, { useState, useEffect, useRef } from 'react';
import { 
  AspectRatio, 
  ImageSize, 
  ModelType, 
  GeneratedImage, 
  GenerationSettings 
} from './types';
import { generateImage } from './services/gemini';
import Sidebar from './components/Sidebar';
import Gallery from './components/Gallery';
import { Header } from './components/Header';
import { loadSavedData, setDBItem } from './services/storage';

const defaultSettings: GenerationSettings = {
  prompt: '',
  negativePrompt: '',
  aspectRatio: '1:1',
  customDimensions: { width: 2200, height: 2200 },
  imageSize: '1K',
  model: 'gemini-3.1-flash-lite-image',
  sourceImages: [],
  safetyFilter: 'block_none',
};

const App: React.FC = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [settings, setSettings] = useState<GenerationSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved data from IndexedDB on initial mount
  useEffect(() => {
    loadSavedData().then(({ images: savedImages, settings: savedSettings }) => {
      if (savedImages && savedImages.length > 0) {
        setImages(savedImages);
      }
      if (savedSettings) {
        let normalizedModel = savedSettings.model;
        if (
          normalizedModel === ('gemini-2.5-flash-image' as any) ||
          normalizedModel === ('imagen-4.0-generate-001' as any) ||
          normalizedModel === ('imagen-3.0-generate-002' as any) ||
          (typeof normalizedModel === 'string' && normalizedModel.startsWith('imagen'))
        ) {
          normalizedModel = 'gemini-3.1-flash-image';
        }
        setSettings(prev => ({
          ...prev,
          ...savedSettings,
          safetyFilter: savedSettings.safetyFilter || 'block_none',
          model: normalizedModel || prev.model,
        }));
      }
      setIsLoaded(true);
    }).catch(err => {
      console.error("Failed to load saved data from IndexedDB:", err);
      setIsLoaded(true);
    });
  }, []);

  // Save images to IndexedDB whenever images state changes (safeguard against empty overwrite on mount)
  const initialLoadCompletedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!initialLoadCompletedRef.current) {
      initialLoadCompletedRef.current = true;
      // On the very first tick after load, do not overwrite storage if state happens to be empty
      if (images.length === 0) return;
    }
    setDBItem('saved_images', images);
  }, [images, isLoaded]);

  // Save settings to IndexedDB whenever settings state changes
  useEffect(() => {
    if (!isLoaded) return;
    setDBItem('saved_settings', settings);
  }, [settings, isLoaded]);

  const handleToggleLike = (id: string) => {
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        return { ...img, liked: !img.liked };
      }
      return img;
    }));
  };

  const handleDeleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleGenerate = async () => {
    if (!settings.prompt.trim()) {
      setError("Please enter a prompt first.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    let effectiveModel = settings.model;
    if (
      effectiveModel === ('imagen-4.0-generate-001' as any) ||
      effectiveModel === ('imagen-3.0-generate-002' as any) ||
      (typeof effectiveModel === 'string' && effectiveModel.startsWith('imagen'))
    ) {
      effectiveModel = 'gemini-3.1-flash-image';
    }

    const modelsToGenerate: ModelType[] = effectiveModel === 'all' 
      ? ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image']
      : [effectiveModel];

    try {
      const results = await Promise.all(modelsToGenerate.map(async (model) => {
        try {
          const result = await generateImage({ ...settings, model });
          return {
            id: crypto.randomUUID(),
            url: result.imageUrl,
            prompt: settings.prompt,
            negativePrompt: settings.negativePrompt,
            fullPrompt: result.effectivePrompt,
            sourceImagesCount: result.sourceImagesCount ?? settings.sourceImages?.length ?? 0,
            model: model,
            timestamp: Date.now(),
            aspectRatio: settings.aspectRatio,
            customDimensions: settings.aspectRatio === 'custom' ? settings.customDimensions : undefined,
            textOutput: result.text,
            liked: false,
          };
        } catch (err: any) {
          console.error(`Error generating with ${model}:`, err);
          throw err;
        }
      }));
      
      setImages(prev => [...results.reverse(), ...prev]);
    } catch (err: any) {
      console.error("Generation error:", err);
      let errStr = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      
      if (typeof errStr === 'string' && errStr.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(errStr);
          if (parsed?.error?.message) {
            errStr = parsed.error.message;
          }
        } catch {}
      }

      const isDunningError = errStr.toLowerCase().includes('dunning');
      const isQuotaError = 
        errStr.toLowerCase().includes('quota') || 
        errStr.toLowerCase().includes('resource_exhausted') || 
        errStr.includes('429');

      if (isDunningError) {
        setError(
          "Your selected API key has billing issues (Google billing account is delinquent or suspended). " +
          "Please verify your billing status in GCP or try another project key in Settings > Secrets."
        );
      } else if (isQuotaError) {
        setError(
          "API Quota exceeded for image generation. Please verify your Gemini API key's tier and billing plan in Google AI Studio / GCP, or try again in a few minutes."
        );
      } else {
        setError(errStr || "An unexpected error occurred during generation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddReference = (url: string, role: 'style' | 'character' | 'subject') => {
    if (settings.sourceImages.length >= 6) {
      setError("Maximum 6 reference images allowed across buckets. Please remove one first.");
      return;
    }
    const base64 = url.startsWith('data:') ? url.split(',')[1] : url;
    const mime = url.startsWith('data:') ? (url.split(';')[0].split(':')[1] || 'image/png') : 'image/png';
    setSettings(prev => ({
      ...prev,
      sourceImages: [
        ...prev.sourceImages,
        {
          id: crypto.randomUUID(),
          data: base64,
          mimeType: mime,
          role,
        }
      ]
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      <Header />
      
      <main className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        <Sidebar 
          settings={settings} 
          setSettings={setSettings} 
          onGenerate={handleGenerate} 
          isGenerating={isGenerating}
        />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-zinc-950/50">
          {error && (() => {
            const isImageSafety = error.includes("IMAGE_SAFETY");
            const isProhibited = error.includes("PROHIBITED_CONTENT");

            if (isImageSafety || isProhibited) {
              return (
                <div className="mb-6 p-5 bg-gradient-to-r from-amber-950/40 via-red-950/30 to-zinc-900 border border-amber-500/40 rounded-2xl shadow-xl shadow-amber-500/5 text-zinc-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl leading-none">🛡️</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                            {isImageSafety ? "Output Visual Safety Flagged (IMAGE_SAFETY)" : "Content Policy Stopped (PROHIBITED_CONTENT)"}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {isImageSafety ? "Post-Generation Vision Filter" : "Prompt / Reference Filter"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                          {isImageSafety ? (
                            <>
                              <strong className="text-amber-200">Why even with Relaxed?</strong> Google uses a dual safety layer: while <em className="text-white">Relaxed (BLOCK_NONE)</em> loosens the prompt text filter, the <strong className="text-white">Output Vision Classifier</strong> inspects the generated pixels and cannot be bypassed via API settings or account tiers.
                            </>
                          ) : (
                            <>
                              The model halted generation because words in your prompt or reference images triggered Google's sensitive content guidelines.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setError(null)}
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                      aria-label="Dismiss message"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Diagnostic Details & Common Causes */}
                  <div className="mt-3.5 pt-3 border-t border-amber-500/20 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-1.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                        <span>🔍</span> Common Visual Triggers
                      </div>
                      <ul className="text-zinc-400 space-y-1 list-disc list-inside">
                        <li>Skin exposure, swimwear, or implied bare skin</li>
                        <li>Photorealistic real-person facial likeness</li>
                        <li>Weapons, firearms, tactical gear, or stylized violence</li>
                        <li>Reference photos in Style/Character containing real faces/skin</li>
                      </ul>
                    </div>

                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                        <span>⚡</span> 1-Click Fixes & Adjustments
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => {
                            setSettings(s => ({
                              ...s,
                              prompt: s.prompt ? `${s.prompt.trim()}, fully clothed in modern casual streetwear, concept art illustration style` : "fully clothed in modern casual streetwear, concept art illustration style",
                              negativePrompt: s.negativePrompt ? `${s.negativePrompt}, nude, exposed skin, real face` : "nude, exposed skin, real face"
                            }));
                            setError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 transition-all active:scale-95"
                          title="Append clothing and stylized rendering cues to prompt"
                        >
                          + Add Safe Clothing & Style Tags
                        </button>
                        <button
                          onClick={() => {
                            setSettings(s => ({
                              ...s,
                              model: s.model === 'gemini-3.1-flash-lite-image' ? 'gemini-3.1-flash-image' : 'gemini-3.1-flash-lite-image'
                            }));
                            setError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-bold text-[10px] border border-yellow-500/30 transition-all active:scale-95"
                          title="Switch between Banana Flash 2 and Banana Flash"
                        >
                          🔄 Switch Model ({settings.model === 'gemini-3.1-flash-lite-image' ? 'Try Flash' : 'Try Flash Lite'})
                        </button>
                        {settings.safetyFilter !== 'block_none' && (
                          <button
                            onClick={() => {
                              setSettings(s => ({ ...s, safetyFilter: 'block_none' }));
                              setError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-[10px] border border-purple-500/30 transition-all active:scale-95"
                            title="Set prompt filter to Relaxed"
                          >
                            🔓 Set Filter to Relaxed
                          </button>
                        )}
                        {settings.sourceImages.length > 0 && (
                          <button
                            onClick={() => {
                              setSettings(s => ({ ...s, sourceImages: [] }));
                              setError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] border border-red-500/30 transition-all active:scale-95"
                            title="Clear all reference bucket images"
                          >
                            🗑️ Clear Reference Images
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Raw Diagnostics Accordion */}
                  <details className="mt-3 text-[10px] text-zinc-400 cursor-pointer">
                    <summary className="hover:text-zinc-200 select-none">
                      View Raw Model Diagnostic Output
                    </summary>
                    <div className="mt-1.5 p-2.5 rounded-lg bg-black/60 font-mono text-[9.5px] text-zinc-300 whitespace-pre-wrap border border-white/5 break-words">
                      {error}
                    </div>
                  </details>
                </div>
              );
            }

            return (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <p className="text-sm">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="ml-auto text-red-400 hover:text-red-300 p-1"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            );
          })()}

          <Gallery 
            images={images} 
            isGenerating={isGenerating} 
            onToggleLike={handleToggleLike}
            onDeleteImage={handleDeleteImage}
            onAddToReference={handleAddReference}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
