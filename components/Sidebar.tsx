
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GenerationSettings, AspectRatio, ImageSize, ModelType, SourceImage, ReferenceRole, ReferenceStrength } from '../types';

interface SidebarProps {
  settings: GenerationSettings;
  setSettings: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

const MAX_IMAGES = 6;

const Sidebar: React.FC<SidebarProps> = ({ settings, setSettings, onGenerate, isGenerating }) => {
  const aspectRatios: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9', 'custom'];
  const sizes: ImageSize[] = ['1K', '2K', '4K'];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showsResolution = [
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'all'
  ].includes(settings.model);

  const getRatioLabel = (ratio: string) => {
    switch (ratio) {
      case '3:4':
      case '9:16':
        return `${ratio} ↕️`;
      case '4:3':
      case '16:9':
        return `${ratio} ↔️`;
      default:
        return ratio;
    }
  };

  const getResolutionLabel = (
    ratio: AspectRatio, 
    imageSize: ImageSize, 
    customDimensions?: { width: number; height: number }
  ): string => {
    if (ratio === 'custom') {
      if (customDimensions) {
        return `${customDimensions.width || 2200} × ${customDimensions.height || 2200} px`;
      }
      return '2200 × 2200 px';
    }

    let baseW = 1024;
    let baseH = 1024;

    switch (ratio) {
      case '1:1':
        baseW = 1024;
        baseH = 1024;
        break;
      case '3:4':
        baseW = 896;
        baseH = 1152;
        break;
      case '4:3':
        baseW = 1152;
        baseH = 896;
        break;
      case '9:16':
        baseW = 768;
        baseH = 1344;
        break;
      case '16:9':
        baseW = 1344;
        baseH = 768;
        break;
    }

    let factor = 1;
    if (imageSize === '2K') factor = 2;
    if (imageSize === '4K') factor = 4;

    return `${baseW * factor} × ${baseH * factor} px`;
  };

  const [widthText, setWidthText] = useState<string>(settings.customDimensions?.width?.toString() || '2200');
  const [heightText, setHeightText] = useState<string>(settings.customDimensions?.height?.toString() || '2200');
  const [showPromptTip, setShowPromptTip] = useState(false);

  useEffect(() => {
    if (settings.customDimensions) {
      setWidthText(prev => {
        const val = settings.customDimensions?.width;
        if (val === undefined) return prev;
        const currentNum = parseInt(prev, 10) || 0;
        return currentNum !== val ? val.toString() : prev;
      });
      setHeightText(prev => {
        const val = settings.customDimensions?.height;
        if (val === undefined) return prev;
        const currentNum = parseInt(prev, 10) || 0;
        return currentNum !== val ? val.toString() : prev;
      });
    }
  }, [settings.customDimensions]);

  const handleWidthChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setWidthText(cleaned);
    const numValue = parseInt(cleaned, 10) || 0;
    setSettings(s => ({
      ...s,
      customDimensions: {
        width: numValue,
        height: s.customDimensions?.height || 2200,
      }
    }));
  };

  const handleHeightChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setHeightText(cleaned);
    const numValue = parseInt(cleaned, 10) || 0;
    setSettings(s => ({
      ...s,
      customDimensions: {
        width: s.customDimensions?.width || 2200,
        height: numValue,
      }
    }));
  };

  const handleWidthBlur = () => {
    if (!widthText || widthText === '0') {
      const fallback = 2200;
      setWidthText(fallback.toString());
      setSettings(s => ({
        ...s,
        customDimensions: {
          width: fallback,
          height: s.customDimensions?.height || 2200,
        }
      }));
    }
  };

  const handleHeightBlur = () => {
    if (!heightText || heightText === '0') {
      const fallback = 2200;
      setHeightText(fallback.toString());
      setSettings(s => ({
        ...s,
        customDimensions: {
          width: s.customDimensions?.width || 2200,
          height: fallback,
        }
      }));
    }
  };

  const [isDropZoneHovered, setIsDropZoneHovered] = useState(false);

  const addSourceImage = useCallback((
    data: string,
    mimeType: string,
    role: ReferenceRole = 'style',
    strength: ReferenceStrength = 'balanced',
    customInstruction?: string
  ) => {
    setSettings(s => {
      if (s.sourceImages.length >= MAX_IMAGES) return s;
      return {
        ...s,
        sourceImages: [...s.sourceImages, {
          id: crypto.randomUUID(),
          data,
          mimeType,
          role,
          strength,
          customInstruction,
        }]
      };
    });
  }, [setSettings]);

  const addImageFromUrl = useCallback(async (url: string, role: ReferenceRole = 'style') => {
    try {
      if (url.startsWith('data:')) {
        const mime = url.split(';')[0].split(':')[1] || 'image/png';
        const base64 = url.split(',')[1];
        addSourceImage(base64, mime, role);
        return;
      }
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        addSourceImage(base64String, blob.type || 'image/png', role);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Failed to add image from URL:", e);
    }
  }, [addSourceImage]);

  const processFiles = useCallback((files: FileList | File[], targetRole: ReferenceRole = 'style') => {
    const remainingSlots = MAX_IMAGES - settings.sourceImages.length;
    if (remainingSlots <= 0) return;

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        addSourceImage(base64String, file.type, targetRole);
      };
      reader.readAsDataURL(file);
    });
  }, [addSourceImage, settings.sourceImages.length]);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropZoneHovered(false);

    // 1. Check if gallery image dropped
    const customDataStr = e.dataTransfer.getData('application/json');
    if (customDataStr) {
      try {
        const customData = JSON.parse(customDataStr);
        if (customData.type === 'gallery-img' && customData.url) {
          addImageFromUrl(customData.url, 'style');
          return;
        }
      } catch {}
    }

    // 2. Check if local files dropped from OS
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files, 'style');
      return;
    }

    // 3. Web link or data URL
    const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (droppedUrl && (droppedUrl.startsWith('data:image') || droppedUrl.startsWith('http') || droppedUrl.startsWith('blob:'))) {
      addImageFromUrl(droppedUrl, 'style');
      return;
    }
  }, [addImageFromUrl, processFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) processFiles(files, 'style');
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const removeImage = (idOrIndex: string | number) => {
    setSettings(s => ({
      ...s,
      sourceImages: s.sourceImages.filter((img, i) => {
        if (typeof idOrIndex === 'string') {
          return img.id !== idOrIndex;
        }
        return i !== idOrIndex;
      })
    }));
  };

  return (
    <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col bg-[#0a0a0a] shrink-0 max-h-[50vh] md:max-h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Unified Reference Images Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <span>REFERENCE IMAGE BUCKETS</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-yellow-500 font-extrabold rounded-full font-mono">
                {settings.sourceImages.length}/{MAX_IMAGES}
              </span>
            </label>
            {settings.sourceImages.length > 0 && (
              <button 
                onClick={() => setSettings(s => ({ ...s, sourceImages: [] }))}
                className="text-[10px] text-zinc-600 hover:text-red-500 font-bold uppercase transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          
          {/* Main Drag-and-Drop Area */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setIsDropZoneHovered(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDropZoneHovered(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setIsDropZoneHovered(false);
            }}
            onDrop={handleGlobalDrop}
            onClick={() => {
              if (settings.sourceImages.length < MAX_IMAGES) {
                fileInputRef.current?.click();
              }
            }}
            className={`rounded-2xl p-4 text-center border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
              isDropZoneHovered
                ? 'border-yellow-500 bg-yellow-500/15 text-yellow-300 ring-2 ring-yellow-500/30 scale-[1.01]'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 text-zinc-400'
            } ${settings.sourceImages.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <span className="text-xl leading-none">📥</span>
            <div className="text-xs font-bold text-zinc-200">
              {isDropZoneHovered ? '✨ Drop photo here' : 'Drag photo here or click + Add'}
            </div>
            <div className="text-[9px] text-zinc-550 font-normal">
              Supports files from desktop, gallery, & web (up to {MAX_IMAGES})
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
            multiple
          />

          {/* Configured Reference Cards List */}
          {settings.sourceImages.length > 0 && (
            <div className="space-y-3 pt-1">
              {settings.sourceImages.map((img, idx) => {
                const currentRole: ReferenceRole = img.role || 'style';
                const currentStrength: ReferenceStrength = img.strength || 'balanced';
                const strengthIndex = currentStrength === 'subtle' ? 0 : currentStrength === 'balanced' ? 1 : currentStrength === 'strong' ? 2 : 3;

                return (
                  <div 
                    key={img.id || idx}
                    className="p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800 hover:border-zinc-700/80 transition-all space-y-2.5 shadow-sm"
                  >
                    {/* Header Row: Thumbnail + Index + Delete */}
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10 shadow-inner">
                        <img 
                          src={`data:${img.mimeType};base64,${img.data}`} 
                          alt={`Reference #${idx + 1}`}
                          className="w-full h-full object-cover" 
                        />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 backdrop-blur-xs text-[8px] font-black text-yellow-400 px-1 rounded leading-tight">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-zinc-200 flex items-center gap-1.5">
                            <span>Reference #{idx + 1}</span>
                            <span className="text-[9px] font-bold text-yellow-500/90 uppercase tracking-tight">
                              • {currentRole}
                            </span>
                          </span>
                          <button
                            onClick={() => removeImage(img.id || idx)}
                            className="w-5 h-5 rounded-full bg-zinc-800 hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center text-[10px] transition-colors"
                            title="Remove reference"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-[9.5px] text-zinc-500 truncate mt-0.5">
                          {currentRole === 'style' && 'Aesthetic, colors, tactile weave'}
                          {currentRole === 'character' && 'Face likeness, hair, persona'}
                          {currentRole === 'subject' && 'Layout, framing, composition'}
                          {currentRole === 'custom' && 'Free-form customized instruction'}
                        </div>
                      </div>
                    </div>

                    {/* Role Selector Buttons */}
                    <div className="space-y-1">
                      <div className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider">
                        Role
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {(['style', 'character', 'subject', 'custom'] as const).map((r) => {
                          const isActive = currentRole === r;
                          const label = r === 'style' ? '🎨 Style' : r === 'character' ? '🎭 Char' : r === 'subject' ? '📐 Layout' : '✍️ Custom';
                          return (
                            <button
                              key={r}
                              onClick={() => {
                                setSettings(s => ({
                                  ...s,
                                  sourceImages: s.sourceImages.map((item, i) =>
                                    i === idx ? { ...item, role: r } : item
                                  )
                                }));
                              }}
                              className={`py-1 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all border ${
                                isActive
                                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-sm'
                                  : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4-Tier Strength Slider: Subtle (25%), Balanced (50%), Strong (75%), Exact (100%) */}
                    <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="font-extrabold text-zinc-400 uppercase tracking-wider">Influence Strength</span>
                        <span className="font-mono font-bold text-yellow-400">
                          {currentStrength === 'subtle' && 'Subtle (25%)'}
                          {currentStrength === 'balanced' && 'Balanced (50%)'}
                          {currentStrength === 'strong' && 'Strong (75%)'}
                          {currentStrength === 'exact' && 'Exact (100%)'}
                        </span>
                      </div>
                      <div className="px-1">
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="1"
                          value={strengthIndex}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const newStrength: ReferenceStrength = val === 0 ? 'subtle' : val === 1 ? 'balanced' : val === 2 ? 'strong' : 'exact';
                            setSettings(s => ({
                              ...s,
                              sourceImages: s.sourceImages.map((item, i) =>
                                i === idx ? { ...item, strength: newStrength } : item
                              )
                            }));
                          }}
                          className="w-full accent-yellow-500 cursor-pointer h-1 bg-zinc-800 rounded-lg appearance-none"
                        />
                        <div className="flex justify-between text-[7.5px] font-bold text-zinc-600 mt-1 uppercase tracking-tight px-0.5">
                          <span>25%</span>
                          <span className="text-zinc-400">50% (Default)</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    {/* Free-form Direction Text Input */}
                    <div className="space-y-1 pt-1 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider">
                          {currentRole === 'custom' ? 'Custom Steering Direction' : 'Specific Focus Direction (Optional)'}
                        </label>
                      </div>
                      <input
                        type="text"
                        value={img.customInstruction || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => ({
                            ...s,
                            sourceImages: s.sourceImages.map((item, i) =>
                              i === idx ? { ...item, customInstruction: val } : item
                            )
                          }));
                        }}
                        placeholder={
                          currentRole === 'style' ? 'e.g. transfer only the cream weave fabric texture, skip foreground' :
                          currentRole === 'character' ? 'e.g. keep facial bone structure, update hairstyle' :
                          currentRole === 'subject' ? 'e.g. preserve top-down framing and camera distance' :
                          'Describe exactly how the model should use this reference image...'
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-500/50 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/20"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Prompt Input */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 relative">
              <label className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
                <span>IMAGE PROMPT</span>
              </label>

              {/* Info / Tooltip Toggle Button */}
              <button
                type="button"
                onClick={() => setShowPromptTip(prev => !prev)}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  showPromptTip 
                    ? 'bg-yellow-500 text-black shadow-md' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
                title="View Layered Prompting & Template Guidance"
              >
                ?
              </button>

              {/* Tooltip Popover */}
              {showPromptTip && (
                <div className="absolute top-6 left-0 z-30 w-72 p-3.5 bg-zinc-950 border border-zinc-750 rounded-2xl shadow-2xl space-y-2 text-[10px] text-zinc-300 animate-fadeIn backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                    <span className="font-bold text-yellow-400 flex items-center gap-1">
                      <span>💡</span> Layered Prompting Tips
                    </span>
                    <button 
                      onClick={() => setShowPromptTip(false)}
                      className="text-zinc-500 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="leading-relaxed text-zinc-400">
                    You can reference specific photos (like <span className="text-yellow-400 font-mono font-bold">#1</span> or <span className="text-yellow-400 font-mono font-bold">#2</span>) directly in your prompt text!
                  </p>
                  {settings.sourceImages.length > 0 && (
                    <button
                      onClick={() => {
                        const charIndices = settings.sourceImages.map((img, i) => ({ img, i: i + 1 })).filter(x => x.img.role === 'character');
                        const styleIndices = settings.sourceImages.map((img, i) => ({ img, i: i + 1 })).filter(x => x.img.role === 'style');
                        const subjIndices = settings.sourceImages.map((img, i) => ({ img, i: i + 1 })).filter(x => x.img.role === 'subject');
                        
                        let template = '';
                        if (charIndices.length > 0) {
                          template += `[Subject]: A stunning, professional portrait of the person from ${charIndices.map(x => `#${x.i}`).join(' and ')}. Keep their exact face details perfectly.\n`;
                        } else {
                          template += `[Subject]: A futuristic space explorer...\n`;
                        }
                        if (styleIndices.length > 0) {
                          template += `[Style]: Apply the artistic style, color grading, and beautiful lighting dynamics of ${styleIndices.map(x => `#${x.i}`).join(' and ')}.\n`;
                        }
                        if (subjIndices.length > 0) {
                          template += `[Composition]: Adopt the framing, camera pose, and spatial scene layout of ${subjIndices.map(x => `#${x.i}`).join(' and ')}.`;
                        }
                        
                        setSettings(s => ({
                          ...s,
                          prompt: template || "[Subject]: ...\n[Style]: ..."
                        }));
                        setShowPromptTip(false);
                      }}
                      className="w-full py-1.5 px-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-[9.5px] font-bold border border-yellow-500/30 text-center transition-colors"
                    >
                      ⚡ Insert Layered Prompt Template
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <textarea
            value={settings.prompt}
            onChange={(e) => setSettings(s => ({ ...s, prompt: e.target.value }))}
            placeholder={settings.sourceImages.length > 0 
              ? "How should these be combined? Refer to #1, #2 to guide individual layers..." 
              : "A futuristic city at night..."}
            className="w-full h-28 min-h-[112px] bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.03)] resize-y transition-all"
          />

          {/* Negative Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>
                <span>Negative Prompt</span>
                <span className="text-[9px] text-zinc-600 font-normal lowercase">(optional)</span>
              </label>
              {settings.negativePrompt && (
                <button
                  onClick={() => setSettings(s => ({ ...s, negativePrompt: '' }))}
                  className="text-[9px] text-zinc-600 hover:text-zinc-400 font-bold uppercase transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="text"
              value={settings.negativePrompt || ''}
              onChange={(e) => setSettings(s => ({ ...s, negativePrompt: e.target.value }))}
              placeholder="e.g. blurry, distorted text, extra limbs, low resolution"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 shadow-[inset_0_0_15px_rgba(239,68,68,0.03)] transition-all"
            />
          </div>
        </section>

        {/* Aspect Ratio */}
        <section className="space-y-3">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Aspect Ratio</label>
          <div className="flex flex-wrap gap-2">
            {aspectRatios.map((ratio) => (
              <button
                key={ratio}
                onClick={() => {
                  setSettings(s => ({ 
                    ...s, 
                    aspectRatio: ratio,
                    customDimensions: ratio === 'custom' && !s.customDimensions 
                      ? { width: 2200, height: 2200 } 
                      : s.customDimensions
                  }));
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all capitalize ${
                  settings.aspectRatio === ratio 
                  ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg shadow-yellow-500/20' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {getRatioLabel(ratio)}
              </button>
            ))}
          </div>
        </section>

        {/* Resolution Section (Preset buttons for standard aspect ratios, Width/Height inputs for custom) */}
        {(showsResolution || settings.aspectRatio === 'custom') && (
          <section className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-baseline">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Resolution</label>
              <span className="text-[10px] text-yellow-500 font-mono font-bold">
                {getResolutionLabel(settings.aspectRatio, settings.imageSize, settings.customDimensions)}
              </span>
            </div>

            {settings.aspectRatio === 'custom' ? (
              <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Width (px) ↔️</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={widthText}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    onBlur={handleWidthBlur}
                    placeholder="2200"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Height (px) ↕️</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={heightText}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    onBlur={handleHeightBlur}
                    placeholder="2200"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                  />
                </div>
              </div>
            ) : (
              showsResolution && (
                <div className="grid grid-cols-3 gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSettings(s => ({ ...s, imageSize: size }))}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        settings.imageSize === size 
                        ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg shadow-yellow-500/20' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {/* Model Selection (Positioned below Aspect Ratio & Resolution) */}
        <section className="space-y-3">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Model</label>
          <div className="grid grid-cols-1 gap-2">
            {/* Banana Flash */}
            <button
              onClick={() => setSettings(s => ({ ...s, model: 'gemini-3.1-flash-lite-image' }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.model === 'gemini-3.1-flash-lite-image' || settings.model === ('gemini-2.5-flash-image' as any)
                ? 'bg-zinc-800 border-yellow-500/50 text-white shadow-[inset_0_0_20px_rgba(234,179,8,0.05)]' 
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-sm">Banana Flash</div>
              <div className="text-[10px] opacity-60">Fast & Watermark-Free (Banana Flash Lite)</div>
            </button>

            {/* Banana Flash 2 */}
            <button
              onClick={() => setSettings(s => ({ ...s, model: 'gemini-3.1-flash-image' }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.model === 'gemini-3.1-flash-image' || settings.model === 'gemini-3.1-flash-image-preview'
                ? 'bg-zinc-800 border-yellow-500/50 text-white shadow-[inset_0_0_20px_rgba(234,179,8,0.05)]' 
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-sm flex items-center gap-2">
                Banana Flash 2 <span className="px-1.5 py-0.5 rounded bg-zinc-700 text-[8px] text-zinc-300 font-black uppercase">Stable</span>
              </div>
              <div className="text-[10px] opacity-60">Enhanced Quality & Multi-Ref Coherence</div>
            </button>

            {/* Banana Pro */}
            <button
              onClick={() => setSettings(s => ({ ...s, model: 'gemini-3-pro-image' }))}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                settings.model === 'gemini-3-pro-image' || settings.model === 'gemini-3-pro-image-preview'
                ? 'bg-zinc-800 border-yellow-500 text-white shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]' 
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-sm flex items-center gap-2">
                Banana Pro <span className="px-1.5 py-0.5 rounded bg-yellow-500 text-[8px] text-black font-black uppercase">High Fidelity</span>
              </div>
              <div className="text-[10px] opacity-60">Requires Paid API Key (Gemini 3 Pro)</div>
            </button>

            {/* All Models */}
            <button
              onClick={() => setSettings(s => ({ ...s, model: 'all' }))}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                settings.model === 'all' 
                ? 'bg-zinc-800 border-yellow-500 text-white shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]' 
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-sm flex items-center gap-2">
                All Models <span className="px-1.5 py-0.5 rounded bg-zinc-700 text-[8px] text-zinc-300 font-black uppercase">3x Output</span>
              </div>
              <div className="text-[10px] opacity-60">Compare Flash Lite, Flash 2, and Pro in a single click</div>
            </button>
          </div>
        </section>

        {/* Content Safety Filter Section */}
        <section className="space-y-3">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>🛡️ Content Safety Filter</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSettings(s => ({ ...s, safetyFilter: 'block_none' }))}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                (settings.safetyFilter || 'block_none') === 'block_none'
                  ? 'bg-zinc-800 border-green-500/60 text-white shadow-[inset_0_0_15px_rgba(34,197,94,0.08)]'
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs text-green-400">Relaxed</div>
              <div className="text-[9px] opacity-70 mt-0.5 leading-tight">BLOCK_NONE (Lowest restriction)</div>
            </button>

            <button
              onClick={() => setSettings(s => ({ ...s, safetyFilter: 'block_only_high' }))}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                settings.safetyFilter === 'block_only_high'
                  ? 'bg-zinc-800 border-yellow-500/60 text-white shadow-[inset_0_0_15px_rgba(234,179,8,0.08)]'
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs text-yellow-400">Permissive</div>
              <div className="text-[9px] opacity-70 mt-0.5 leading-tight">Block only high probability</div>
            </button>

            <button
              onClick={() => setSettings(s => ({ ...s, safetyFilter: 'block_medium_and_above' }))}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                settings.safetyFilter === 'block_medium_and_above'
                  ? 'bg-zinc-800 border-zinc-500 text-white shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]'
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs text-zinc-300">Standard</div>
              <div className="text-[9px] opacity-70 mt-0.5 leading-tight">Default Gemini safety filter</div>
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-[10px] text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <span>ℹ️ Why restrictions trigger:</span>
            </div>
            <p className="leading-relaxed text-zinc-400">
              <strong className="text-zinc-200">Relaxed</strong> sets API thresholds to <code className="text-yellow-400 font-mono text-[9px]">BLOCK_NONE</code>. If you still encounter <span className="text-red-400 font-mono text-[9px]">PROHIBITED_CONTENT</span> or <span className="text-red-400 font-mono text-[9px]">IMAGE_SAFETY</span>, it is due to Google's hardwired platform rules (CSAM, extreme violence, real people) or false-positive pixel classifiers. Try rephrasing prompt descriptors or switching models.
            </p>
          </div>
        </section>

      </div>

      {/* Persistent CTA */}
      <div className="p-6 border-t border-zinc-800 bg-[#0a0a0a]">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
            isGenerating 
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
            : 'banana-gradient text-black hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(234,179,8,0.2)]'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin"></div>
              <span>{settings.sourceImages.length > 0 ? 'Remixing...' : 'Creating...'}</span>
            </>
          ) : (
            <>
              <span>{settings.sourceImages.length > 0 ? 'Remix Visuals' : 'Generate Image'}</span>
              <span className="text-xl leading-none">{settings.sourceImages.length > 0 ? '🪄' : '✨'}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
