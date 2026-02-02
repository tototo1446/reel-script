
import React from 'react';
import { AnalysisData } from '../types';
import { BUZZ_THRESHOLD } from '../constants';

interface AnalysisCardProps {
  data: AnalysisData;
  onDelete: (id: string) => void;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ data, onDelete }) => {
  const isBuzz = data.buzzRate >= BUZZ_THRESHOLD;

  return (
    <div className="glass rounded-2xl p-6 border-l-4 border-l-pink-500 relative overflow-hidden">
      {isBuzz && (
        <div className="absolute top-0 right-0 buzz-gradient px-4 py-1 text-xs font-bold rounded-bl-xl uppercase tracking-wider">
          Buzz Detected (x{data.buzzRate.toFixed(1)})
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{data.title}</h3>
          <div className="flex gap-4 text-sm text-zinc-400">
            <span>再生: {data.views.toLocaleString()}</span>
            <span>フォロワー: {data.followers.toLocaleString()}</span>
            <span>秒数: {data.duration}s</span>
          </div>
        </div>
        <button 
          onClick={() => onDelete(data.id)}
          className="text-zinc-500 hover:text-red-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <div className="text-xs font-bold text-pink-400 uppercase mb-2">Layer 1: Structure</div>
          <ul className="text-xs space-y-2 text-zinc-300">
            <li><span className="text-zinc-500 font-bold">フック:</span> {data.structure.hook}</li>
            <li><span className="text-zinc-500 font-bold">問題:</span> {data.structure.problem}</li>
            <li><span className="text-zinc-500 font-bold">解決:</span> {data.structure.solution}</li>
            <li><span className="text-zinc-500 font-bold">CTA:</span> {data.structure.cta}</li>
          </ul>
        </div>

        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <div className="text-xs font-bold text-blue-400 uppercase mb-2">Layer 2: Direction</div>
          <ul className="text-xs space-y-2 text-zinc-300">
            <li><span className="text-zinc-500 font-bold">カメラ:</span> {data.direction.camera}</li>
            <li><span className="text-zinc-500 font-bold">配置:</span> {data.direction.person}</li>
            <li><span className="text-zinc-500 font-bold">テロップ:</span> {data.direction.caption}</li>
          </ul>
        </div>

        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <div className="text-xs font-bold text-emerald-400 uppercase mb-2">Layer 3: Transcription</div>
          <p className="text-xs text-zinc-400 italic line-clamp-4 leading-relaxed">
            "{data.transcription}"
          </p>
        </div>
      </div>
    </div>
  );
};
