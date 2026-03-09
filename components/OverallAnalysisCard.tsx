
import React, { useState } from 'react';
import { VideoOverallAnalysis } from '../types';

interface OverallAnalysisCardProps {
  analysis: VideoOverallAnalysis;
}

const SectionBlock: React.FC<{ label: string; icon: string; content: string; color: string }> = ({ label, icon, content, color }) => (
  <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
    <div className={`text-xs font-bold uppercase mb-2 flex items-center gap-1.5 ${color}`}>
      <span>{icon}</span>
      {label}
    </div>
    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{content}</p>
  </div>
);

export const OverallAnalysisCard: React.FC<OverallAnalysisCardProps> = ({ analysis }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass p-6 rounded-2xl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-2 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></span>
          動画全体分析（音声込み）
          <span className="text-xs font-normal text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">完了</span>
        </h3>
        <svg
          className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3 animate-in fade-in duration-300">
          {/* 文字起こし（全幅） */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <div className="text-xs font-bold uppercase mb-2 flex items-center gap-1.5 text-pink-400">
              <span>🎤</span>
              文字起こし
            </div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
              {analysis.transcription}
            </p>
          </div>

          {/* 2カラムグリッド */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SectionBlock label="冒頭フック分析" icon="🎯" content={analysis.hookAnalysis} color="text-amber-400" />
            <SectionBlock label="全体構成" icon="📐" content={analysis.overallStructure} color="text-blue-400" />
            <SectionBlock label="ナレーションスタイル" icon="🗣" content={analysis.narrationStyle} color="text-emerald-400" />
            <SectionBlock label="テンポ・ペース感" icon="⚡" content={analysis.pacing} color="text-cyan-400" />
            <SectionBlock label="BGM・音楽" icon="🎵" content={analysis.bgm} color="text-purple-400" />
            <SectionBlock label="効果音・環境音" icon="🔊" content={analysis.soundEffects} color="text-orange-400" />
          </div>

          {/* 感情トーン */}
          <SectionBlock label="感情トーン" icon="💫" content={analysis.emotionalTone} color="text-rose-400" />
        </div>
      )}
    </div>
  );
};
