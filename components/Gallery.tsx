
import React, { useState } from 'react';
import { GeneratedImage } from '../types';
import { FullResolutionModal } from './FullResolutionModal';
import { formatDownloadFilename } from '../utils/filename';

interface GalleryProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  onToggleLike: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onAddToReference?: (imageUrl: string, role: 'style' | 'character' | 'subject') => void;
}

const Gallery: React.FC<GalleryProps> = ({ 
  images, 
  isGenerating, 
  onToggleLike, 
  onDeleteImage,
  onAddToReference,
}) => {
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'liked'>('all');
  const [modalImage, setModalImage] = useState<GeneratedImage | null>(null);

  const handleOpenFullSize = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error("Failed to open full size image:", err);
      window.open(imageUrl, '_blank');
    }
  };

  const handleCopyImage = async (e: React.MouseEvent, id: string, imageUrl: string) => {
    e.stopPropagation();
    try {
      let blob: Blob;

      if (imageUrl.startsWith('data:')) {
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
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedImageId(id);
        setTimeout(() => setCopiedImageId(null), 2000);
      } else {
        await navigator.clipboard.writeText(imageUrl);
        setCopiedImageId(id);
        setTimeout(() => setCopiedImageId(null), 2000);
      }
    } catch (err) {
      console.warn("Failed to copy image to clipboard, copying URL instead:", err);
      try {
        await navigator.clipboard.writeText(imageUrl);
        setCopiedImageId(id);
        setTimeout(() => setCopiedImageId(null), 2000);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCopyPrompt = (e: React.MouseEvent, id: string, promptText: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const likedCount = images.filter(i => i.liked).length;
  const displayedImages = filter === 'liked' ? images.filter(i => i.liked) : images;

  if (images.length === 0 && !isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-24 h-24 mb-6 opacity-20 bg-zinc-700 rounded-3xl flex items-center justify-center">
          <span className="text-5xl">🎨</span>
        </div>
        <h3 className="text-xl font-bold text-zinc-300 mb-2">No images generated yet</h3>
        <p className="text-zinc-500 max-w-xs">Enter a prompt on the left to start creating your masterpiece with BananaVision AI.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All Creations ({images.length})
          </button>
          <button
            onClick={() => setFilter('liked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              filter === 'liked'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-zinc-500 hover:text-red-400'
            }`}
          >
            <span>❤️</span> Liked / Saved ({likedCount})
          </button>
        </div>

        {likedCount > 0 && (
          <span className="text-[10px] text-zinc-500 font-medium bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800">
            💾 Liked images automatically save across app reloads
          </span>
        )}
      </div>

      {displayedImages.length === 0 && filter === 'liked' && !isGenerating ? (
        <div className="py-16 text-center space-y-3">
          <div className="text-4xl">❤️</div>
          <p className="text-zinc-400 font-medium text-sm">No liked images yet</p>
          <p className="text-zinc-600 text-xs max-w-xs mx-auto">Click the heart icon on any generated image to keep it saved when you reload the app.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isGenerating && (
            <div className="aspect-square bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 space-y-4 animate-pulse">
              <div className="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="text-zinc-400 font-medium text-sm">Visualizing...</p>
                <p className="text-zinc-600 text-[10px] mt-1">Harnessing Gemini Banana Power</p>
              </div>
            </div>
          )}

          {displayedImages.map((image) => (
            <div 
              key={image.id} 
              onClick={() => setModalImage(image)}
              className={`group relative bg-zinc-900 rounded-2xl border ${
                image.liked ? 'border-red-500/40 shadow-lg shadow-red-500/5' : 'border-zinc-800 hover:border-zinc-700'
              } overflow-hidden transition-all hover:shadow-2xl hover:shadow-yellow-500/10 cursor-pointer`}
              title="Click to inspect 100% full-resolution image"
            >
              {/* Image Container */}
              <div 
                className={`relative overflow-hidden ${
                  image.aspectRatio === '1:1' ? 'aspect-square' : 
                  image.aspectRatio === '4:3' ? 'aspect-[4/3]' : 
                  image.aspectRatio === '3:4' ? 'aspect-[3/4]' : 
                  image.aspectRatio === '16:9' ? 'aspect-[16/9]' : 
                  image.aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                  ''
                }`}
                style={
                  image.aspectRatio === 'custom' && image.customDimensions
                    ? { aspectRatio: `${image.customDimensions.width || 1024} / ${image.customDimensions.height || 1024}` }
                    : (image.aspectRatio === 'custom' ? { aspectRatio: '16/9' } : undefined)
                }
              >
                <img 
                  src={image.url} 
                  alt={image.prompt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 select-none"
                />
                
                {/* Persistent Heart Badge (Tucked tightly into top-right corner, always clear of action buttons) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLike(image.id);
                  }}
                  className={`absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md ${
                    image.liked 
                      ? 'bg-red-500 text-white scale-100 shadow-red-500/40 ring-1 ring-white/20' 
                      : 'bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/90 hover:scale-110 border border-white/10'
                  }`}
                  title={image.liked ? "Remove from Saved" : "Like & Save Image"}
                >
                  <svg className="w-3 h-3" fill={image.liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>

                {/* Overlay Actions (Hover on card) */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end p-2.5 pb-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Magnifying Glass: 100% Native Resolution Pan & Zoom Viewer */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage(image);
                      }}
                      className="w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all shadow-md"
                      title="Inspect 100% Full Resolution with Panning"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFullSize(image.url);
                      }}
                      className="w-7 h-7 bg-zinc-850 hover:bg-zinc-700 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow-md border border-white/10"
                      title="Open in new browser tab"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <a 
                      href={image.url} 
                      download={formatDownloadFilename(image.prompt, image.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all shadow-md"
                      title="Download image"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                    {/* Copy Image Button */}
                    <button 
                      onClick={(e) => handleCopyImage(e, image.id, image.url)}
                      className={`w-7 h-7 ${copiedImageId === image.id ? 'bg-emerald-500' : 'bg-zinc-800 hover:bg-zinc-700'} rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow-md border border-white/10`}
                      title="Copy Image to Clipboard"
                    >
                      {copiedImageId === image.id ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteImage(image.id);
                      }}
                      className="w-7 h-7 bg-zinc-800 hover:bg-red-500 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow-md"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {onAddToReference && (
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/10 w-full justify-center">
                      <div className="text-[7.5px] leading-tight text-zinc-400 font-extrabold uppercase tracking-wider text-right shrink-0">
                        <div>SEND TO</div>
                        <div>BUCKET:</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToReference(image.url, 'style');
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-yellow-500 hover:text-black text-[8.5px] font-bold text-zinc-200 transition-colors border border-white/10"
                        title="Add to Style Bucket"
                      >
                        🎨 Style
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToReference(image.url, 'character');
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-yellow-500 hover:text-black text-[8.5px] font-bold text-zinc-200 transition-colors border border-white/10"
                        title="Add to Character Bucket"
                      >
                        🎭 Char
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToReference(image.url, 'subject');
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-900/90 hover:bg-yellow-500 hover:text-black text-[8.5px] font-bold text-zinc-200 transition-colors border border-white/10"
                        title="Add to Layout Bucket"
                      >
                        📐 Layout
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt Info Panel with Hover Copy Overlay */}
              <div className="relative p-4 overflow-hidden">
                {/* Text content (muted when entire card is hovered) */}
                <div className="transition-all duration-200 group-hover:opacity-20 group-hover:blur-[0.5px]">
                  <p className="text-zinc-200 text-xs line-clamp-2 mb-3 leading-relaxed font-medium">
                    {image.prompt}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      {image.model.includes('pro') ? 'Banana Pro' : image.model.includes('lite') ? 'Banana Flash' : image.model.includes('flash') ? 'Banana Flash 2' : 'Banana Flash'}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-medium">
                      {new Date(image.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Unified overlay over the prompt area on card hover */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-3 pointer-events-none group-hover:pointer-events-auto">
                  <button
                    onClick={(e) => handleCopyPrompt(e, image.id, image.fullPrompt || image.prompt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all ${
                      copiedPromptId === image.id
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 hover:border-yellow-500/50 hover:scale-105 active:scale-95'
                    }`}
                    title="Copy Prompt"
                  >
                    {copiedPromptId === image.id ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Prompt Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 100% Full Resolution Pan & Zoom Modal */}
      <FullResolutionModal
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
        imageUrl={modalImage?.url || ''}
        prompt={modalImage?.prompt}
        fullPrompt={modalImage?.fullPrompt}
        negativePrompt={modalImage?.negativePrompt}
        sourceImagesCount={modalImage?.sourceImagesCount}
        aspectRatio={modalImage?.aspectRatio}
        imageId={modalImage?.id}
      />
    </div>
  );
};

export default Gallery;
