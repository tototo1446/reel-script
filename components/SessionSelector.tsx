
import React from 'react';
import { SessionHistoryItem } from './SessionHistoryList';

interface SessionSelectorProps {
  sessions: SessionHistoryItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });
};

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  selectedIds,
  onSelectionChange,
}) => {
  const completedSessions = sessions.filter(s => s.analysis_status === 'completed');

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(completedSessions.map(s => s.id));
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  if (completedSessions.length === 0) {
    return (
      <div>
        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">
          0. 参考にする分析データ
        </label>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-xs text-zinc-500">
            分析済みのセッションがありません。分析モードで動画を分析すると、ここに表示されます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-bold text-zinc-500 uppercase block mb-2 flex items-center gap-2">
        0. 参考にする分析データ
        {selectedIds.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
            {selectedIds.length}件選択中
          </span>
        )}
      </label>

      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-[10px] px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          全選択
        </button>
        <button
          type="button"
          onClick={handleDeselectAll}
          className="text-[10px] px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          全解除
        </button>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
        {completedSessions.map(session => {
          const isSelected = selectedIds.includes(session.id);
          return (
            <label
              key={session.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-pink-500/5 border-pink-500/30'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(session.id)}
                className="w-4 h-4 rounded border-zinc-600 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 bg-zinc-800"
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isSelected ? 'text-pink-200' : 'text-zinc-300'}`}>
                  {session.video_title || session.video_file_name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>{session.total_scenes}シーン</span>
                  <span>・</span>
                  <span>{formatDuration(session.video_duration)}</span>
                  <span>・</span>
                  <span>{formatDate(session.created_at)}</span>
                  {session.overall_analysis && (
                    <>
                      <span>・</span>
                      <span className="text-purple-400 flex items-center gap-0.5">
                        🎤 音声分析あり
                      </span>
                    </>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
