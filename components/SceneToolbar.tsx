
import React from 'react';
import { SceneViewMode } from '../types';

interface SceneToolbarProps {
  totalScenes: number;
  selectedCount: number;
  viewMode: SceneViewMode;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClear: () => void;
  onDownloadZip: () => void;
  onDownloadTsv: () => void;
  onSetViewMode: (mode: SceneViewMode) => void;
}

export const SceneToolbar: React.FC<SceneToolbarProps> = ({
  selectedCount,
  viewMode,
  onSelectAll,
  onDeselectAll,
  onClear,
  onDownloadZip,
  onDownloadTsv,
  onSetViewMode,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: Selection controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSelectAll}
          className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          全選択
        </button>
        <button
          onClick={onDeselectAll}
          className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          選択解除
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          クリア
        </button>
      </div>

      {/* Right: Download + View mode */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">選択中: {selectedCount}枚</span>

        <button
          onClick={onDownloadZip}
          disabled={selectedCount === 0}
          className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg border border-zinc-700 transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          ZIP DL
        </button>

        <button
          onClick={onDownloadTsv}
          className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          TSV DL
        </button>

        <div className="flex bg-zinc-800/80 rounded-lg border border-zinc-700 overflow-hidden">
          <button
            onClick={() => onSetViewMode('grid')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'grid' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            グリッド
          </button>
          <button
            onClick={() => onSetViewMode('carousel')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'carousel' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            →横スクロール
          </button>
        </div>
      </div>
    </div>
  );
};
