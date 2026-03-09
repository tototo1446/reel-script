
import React from 'react';

export interface SessionHistoryItem {
  id: string;
  video_file_name: string;
  video_file_size: number;
  video_duration: number;
  total_scenes: number;
  analysis_status: string;
  overall_analysis: import('../types').VideoOverallAnalysis | null;
  created_at: string;
}

interface SessionHistoryListProps {
  sessions: SessionHistoryItem[];
  onLoadSession: (session: SessionHistoryItem) => void;
  onDeleteSession: (sessionId: string) => void;
  isLoading?: boolean;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const statusLabel: Record<string, string> = {
  idle: '未分析',
  analyzing: '分析中',
  completed: '完了',
  error: 'エラー',
};

export const SessionHistoryList: React.FC<SessionHistoryListProps> = ({
  sessions,
  onLoadSession,
  onDeleteSession,
  isLoading = false,
}) => {
  if (sessions.length === 0) return null;

  return (
    <div className="mt-12 w-full max-w-2xl">
      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        分析履歴
      </h3>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="glass rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all group flex items-center justify-between gap-4"
          >
            <button
              onClick={() => onLoadSession(session)}
              disabled={isLoading}
              className="flex-1 text-left min-w-0"
            >
              <div className="font-medium text-white truncate">{session.video_file_name}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                <span>{session.total_scenes}シーン</span>
                <span>・</span>
                <span>{formatDuration(session.video_duration)}</span>
                <span>・</span>
                <span
                  className={
                    session.analysis_status === 'completed'
                      ? 'text-emerald-400'
                      : session.analysis_status === 'error'
                        ? 'text-red-400'
                        : 'text-zinc-400'
                  }
                >
                  {statusLabel[session.analysis_status] ?? session.analysis_status}
                </span>
                <span>・</span>
                <span>{formatDate(session.created_at)}</span>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`「${session.video_file_name}」の履歴を削除しますか？`)) {
                  onDeleteSession(session.id);
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
        ))}
      </div>
    </div>
  );
};
