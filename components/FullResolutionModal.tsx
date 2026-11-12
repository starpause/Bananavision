import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formatDownloadFilename } from '../utils/filename';

interface FullResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  prompt?: string;
  negativePrompt?: string;
  fullPrompt?: string;
  sourceImagesCount?: number;
  aspectRatio?: string;
  imageId?: string;
}

export const FullResolutionModal: React.FC<FullResolutionModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  prompt,
  negativePrompt,
  fullPrompt,
  sourceImagesCount = 0,
  aspectRatio,
  imageId = 'art',
}) => {
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [zoomMode, setZoomMode] = useState<'actual' | 'fit'>('actual'); // 'actual' = 100% true pixels
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const [copiedImage, setCopiedImage] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'clean' | 'full' | 'negative'>('clean');

  const textToCopy = (activeTab === 'full' && fullPrompt) ? fullPrompt : (activeTab === 'negative' && negativePrompt) ? negativePrompt : (prompt || '');

  const handleCopyPromptText = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.warn("Failed to copy prompt to clipboard:", err);
    }
  };

  // Measure natural dimensions when image changes or modal opens
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      // Reset position to center
      setPosition({ x: 0, y: 0 });
      setScale(1);
      setZoomMode('actual');
      setCopiedImage(false);
      setCopyError(null);
    };
  }, [isOpen, imageUrl]);

  // Copy full-resolution image to clipboard (both as actual image/png blob for pasting into Photoshop/Figma/Slack, and text fallback)
  const handleCopyImage = async () => {
    try {
      setCopyError(null);
      let blob: Blob;

      if (imageUrl.startsWith('data:')) {
        // Convert base64 data URL to Blob
        const parts = imageUrl.split(';base64,');
        const contentType = parts[0].split(':')[1] || 'image/png';
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        blob = new Blob([uInt8Array], { type: contentType });
      } else {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }

      // If browser doesn't support png directly or format is jpeg, convert through canvas to image/png for navigator.clipboard
      if (blob.type !== 'image/png') {
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.src = imageUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/png'));
        }
      }

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } else {
        throw new Error("ClipboardItem API not supported in this browser.");
      }
    } catch (err: any) {
      console.warn("Failed to copy image blob to clipboard, falling back to URL copy:", err);
      try {
        await navigator.clipboard.writeText(imageUrl);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } catch {
        setCopyError("Right-click the image directly and select 'Copy Image'.");
        setTimeout(() => setCopyError(null), 4000);
      }
    }
  };

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '0') {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setZoomMode('actual');
      }
      if (e.key === '+' || e.key === '=') {
        setScale(s => Math.min(s + 0.25, 4));
      }
      if (e.key === '-') {
        setScale(s => Math.max(s - 0.25, 0.25));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale(prev => Math.min(Math.max(prev * zoomFactor, 0.2), 5));
    setZoomMode('actual');
  }, []);

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // left click only
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetTo100 = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setZoomMode('actual');
  };

  const toggleFit = () => {
    if (zoomMode === 'fit') {
      resetTo100();
    } else {
      if (!containerRef.current || !naturalDimensions) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = (rect.width - 64) / naturalDimensions.width;
      const scaleY = (rect.height - 64) / naturalDimensions.height;
      const fitScale = Math.min(scaleX, scaleY, 1);
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });
      setZoomMode('fit');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] w-screen h-screen flex flex-col bg-black select-none animate-fadeIn"
      style={{ margin: 0, padding: 0, top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div className="h-14 px-4 md:px-6 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">🔍</span>
          <div className="min-w-0">
            <h3 className="text-xs md:text-sm font-black text-zinc-200 uppercase tracking-wider">
              Full-Resolution Viewer
            </h3>
            {naturalDimensions && (
              <div className="text-[10px] text-zinc-400 font-mono">
                {naturalDimensions.width} × {naturalDimensions.height} px
                {aspectRatio ? ` • ${aspectRatio}` : ''} • Current Zoom: {Math.round(scale * 100)}%
              </div>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1 text-xs">
            <button
              onClick={() => setScale(s => Math.max(s - 0.25, 0.25))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 active:scale-95 transition-all"
              title="Zoom Out (-)"
            >
              −
            </button>
            <span className="px-2 font-mono text-[11px] font-bold text-yellow-400 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(s + 0.25, 5))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-300 active:scale-95 transition-all"
              title="Zoom In (+)"
            >
              +
            </button>
          </div>

          <button
            onClick={resetTo100}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              scale === 1 
                ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm' 
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white hover:bg-zinc-850'
            }`}
            title="Reset to 100% 1:1 Pixel Native Resolution (Press 0)"
          >
            100% (1:1)
          </button>

          <button
            onClick={toggleFit}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              zoomMode === 'fit'
                ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white hover:bg-zinc-850'
            }`}
            title="Fit to Screen"
          >
            Fit View
          </button>

          <button
            onClick={handleCopyImage}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              copiedImage
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
            }`}
            title="Copy high-res image to clipboard (Paste directly into Figma, Photoshop, chat, etc.)"
          >
            <span>{copiedImage ? '✓' : '📋'}</span>
            <span>{copiedImage ? 'Copied Image!' : 'Copy Image'}</span>
          </button>

          <a
            href={imageUrl}
            download={formatDownloadFilename(prompt || '', imageId)}
            className="hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 transition-all items-center gap-1.5"
            title="Download full resolution file"
          >
            <span>💾</span>
            <span>Download</span>
          </a>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-black text-base flex items-center justify-center shadow-lg shadow-yellow-500/20 transition-all ml-2 hover:scale-105"
            title="Close viewer (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Interactive Pan Viewport */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        className={`flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-radial-pattern ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
        style={{
          backgroundColor: '#050505',
          backgroundImage: 'radial-gradient(circle, #1a1a1a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.08s ease-out',
            imageRendering: scale > 1.5 ? 'pixelated' : 'auto',
          }}
          className="will-change-transform inline-block shadow-2xl rounded-sm"
        >
          <img
            src={imageUrl}
            alt={prompt || "Full resolution art"}
            draggable={false}
            className="max-w-none block select-contain rounded border border-white/10 shadow-2xl cursor-pointer"
            style={{
              width: naturalDimensions ? `${naturalDimensions.width}px` : 'auto',
              height: naturalDimensions ? `${naturalDimensions.height}px` : 'auto',
            }}
            title="Right-click to Copy Image or Save As"
          />
        </div>

        {/* Panning Instruction Hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-[10px] text-zinc-400 flex items-center gap-2 pointer-events-none shadow-lg">
          <span className="text-yellow-400 font-bold">Pan:</span> Click & drag • 
          <span className="text-yellow-400 font-bold">Zoom:</span> Mouse wheel or +/- • 
          <span className="text-yellow-400 font-bold">100%:</span> Press 0
        </div>
      </div>

      {/* Interactive Prompt Drawer Footer */}
      {prompt && (
        <div className="relative z-30 bg-zinc-950/95 border-t border-zinc-850 backdrop-blur-md transition-all duration-300 shadow-2xl">
          {/* Collapsed Bar / Header */}
          <div 
            onClick={() => setIsDrawerOpen(prev => !prev)}
            className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
            title={isDrawerOpen ? "Collapse Prompt Drawer" : "Open Full Prompt Drawer"}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-extrabold text-zinc-400 uppercase tracking-widest text-[10px] shrink-0 flex items-center gap-1.5">
                <span className="text-yellow-400">⚡</span>
                <span>Prompt</span>
              </span>
              <p className={`text-xs text-zinc-300 leading-relaxed font-mono ${isDrawerOpen ? 'hidden' : 'truncate'}`}>
                {prompt}
              </p>
            </div>

            {/* Actions: Copy Prompt + Up/Down Drawer Arrow */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={handleCopyPromptText}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 ${
                  copiedPrompt
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
                }`}
                title="Copy full prompt text to clipboard"
              >
                <span>{copiedPrompt ? '✓' : '📋'}</span>
                <span className="text-[10px] hidden sm:inline">{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => setIsDrawerOpen(prev => !prev)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${
                  isDrawerOpen
                    ? 'bg-yellow-500 text-black border-yellow-400 rotate-180'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
                }`}
                title={isDrawerOpen ? "Close prompt drawer (Down)" : "Open full prompt drawer (Up)"}
              >
                <svg className="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded Drawer Content */}
          {isDrawerOpen && (
            <div className="px-4 md:px-6 pb-4 pt-2 max-h-64 overflow-y-auto animate-fadeIn border-t border-zinc-900 space-y-2">
              {/* Tabs for switching between clean prompt, negative prompt, and complete model input */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveTab('clean')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border ${
                    activeTab === 'clean'
                      ? 'bg-yellow-500 text-black border-yellow-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  Prompt
                </button>

                {negativePrompt && (
                  <button
                    onClick={() => setActiveTab('negative')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border ${
                      activeTab === 'negative'
                        ? 'bg-red-500 text-white border-red-400'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    Negative Constraints
                  </button>
                )}

                {fullPrompt && (
                  <button
                    onClick={() => setActiveTab('full')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border flex items-center gap-1.5 ${
                      activeTab === 'full'
                        ? 'bg-zinc-800 text-yellow-400 border-yellow-500/50'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span>⚡ Complete Model Input</span>
                    {sourceImagesCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-zinc-700 text-zinc-200 rounded text-[8.5px]">
                        +{sourceImagesCount} ref{sourceImagesCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Tab Display Card */}
              <div className="p-3 rounded-xl bg-black/70 border border-white/5 font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                {activeTab === 'clean' && (
                  <div>{prompt}</div>
                )}
                {activeTab === 'negative' && (
                  <div>{negativePrompt || "No negative constraints applied."}</div>
                )}
                {activeTab === 'full' && (
                  <div>{fullPrompt || prompt}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};
