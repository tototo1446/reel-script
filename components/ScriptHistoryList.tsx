
import React from 'react';
import { ScriptHistoryItem } from '../types';

interface ScriptHistoryListProps {
  scripts: ScriptHistoryItem[];
  onLoadScript: (script: ScriptHistoryItem) => void;
  onDeleteScript: (scriptId: string) => void;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ScriptHistoryList: React.FC<ScriptHistoryListProps> = ({
  scripts,
  onLoadScript,
  onDeleteScript,
}) => {
  if (scripts.length === 0) return null;

  return (
    <div className="glass p-6 rounded-2xl">
      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        台本履歴
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {scripts.map((script) => {
          const isUpdated = script.updated_at !== script.created_at;
          return (
            <div
              key={script.id}
              className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all group flex items-center justify-between gap-3"
            >
              <button
                onClick={() => onLoadScript(script)}
                className="flex-1 text-left min-w-0"
              >
                <div className="font-medium text-white text-sm truncate">{script.theme}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                  <span className="bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">{script.tone}</span>
                  <span>{(script.scenes || []).length}シーン</span>
                  <span>・</span>
                  <span>{formatDate(script.created_at)}</span>
                  {isUpdated && (
                    <>
                      <span>・</span>
                      <span className="text-amber-400">修正済み</span>
                    </>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('この台本履歴を削除しますか？')) {
                    onDeleteScript(script.id);
                  }
                }}
                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="削除"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
