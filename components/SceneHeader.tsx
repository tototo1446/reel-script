
import React from 'react';

interface SceneHeaderProps {
  totalScenes: number;
  onOpenVideoPreview: () => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
  analysisCompleted: boolean;
}

export const SceneHeader: React.FC<SceneHeaderProps> = ({
  totalScenes,
  onOpenVideoPreview,
  onStartAnalysis,
  isAnalyzing,
  analysisCompleted,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <span>🎬</span>
        抽出完了: {totalScenes}シーン検出
      </h2>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenVideoPreview}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl border border-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          元動画を見る
        </button>

        <button
          onClick={onStartAnalysis}
          disabled={isAnalyzing || analysisCompleted}
          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-pink-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {isAnalyzing ? 'AI分析中...' : analysisCompleted ? 'AI分析完了' : 'AI分析を実行'}
        </button>
      </div>
    </div>
  );
};
