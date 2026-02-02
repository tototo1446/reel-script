
import React, { useState } from 'react';
import { GeneratedScript } from '../types';

interface ScriptViewerProps {
  script: GeneratedScript;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ script }) => {
  const [completed, setCompleted] = useState<number[]>([]);

  const toggleScene = (idx: number) => {
    setCompleted(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-3xl border-8 border-zinc-800 overflow-hidden shadow-2xl max-w-[340px] mx-auto">
      <div className="h-6 bg-zinc-800 flex justify-center items-center">
        <div className="w-12 h-1 bg-zinc-700 rounded-full"></div>
      </div>
      
      <div className="p-4 bg-zinc-900 border-b border-zinc-800">
        <h4 className="text-sm font-bold text-white truncate">{script.theme}</h4>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full">{script.tone}</span>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">AI推奨テンポ</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {script.scenes.map((scene, idx) => (
          <div 
            key={idx} 
            onClick={() => toggleScene(idx)}
            className={`transition-all duration-300 cursor-pointer rounded-xl p-3 border ${
              completed.includes(idx) 
              ? 'bg-zinc-900 opacity-40 border-zinc-800' 
              : 'bg-zinc-800 border-zinc-700 shadow-md translate-x-0'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-zinc-500">{scene.time}</span>
              {completed.includes(idx) && (
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            
            <div className="text-sm font-medium text-white mb-2 leading-snug">
              {scene.dialogue}
            </div>

            <div className="space-y-1.5 border-t border-zinc-700/50 pt-2">
              <div className="flex gap-2 items-start">
                <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1 rounded uppercase flex-shrink-0 mt-0.5">Caption</span>
                <span className="text-[11px] text-zinc-400">{scene.caption}</span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1 rounded uppercase flex-shrink-0 mt-0.5">Direction</span>
                <span className="text-[11px] text-blue-300">{scene.direction}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-zinc-900 border-t border-zinc-800 text-center">
        <button className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95">
          撮影完了を報告
        </button>
      </div>
    </div>
  );
};
