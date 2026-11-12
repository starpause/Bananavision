
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-zinc-800 bg-[#0a0a0a] flex items-center px-6 justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg banana-gradient flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
          <span className="text-xl">🍌</span>
        </div>
        <h1 className="text-2xl font-bebas tracking-wider banana-text-gradient">BananaVision AI</h1>
      </div>
      
      <div className="flex items-center gap-6">
        <span className="hidden md:inline text-xs text-zinc-500 uppercase tracking-widest">Powered by Gemini Nano Banana</span>
        <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400">
          v2.5 & v3.0 PRO
        </div>
      </div>
    </header>
  );
};
