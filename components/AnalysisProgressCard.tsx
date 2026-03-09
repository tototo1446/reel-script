
import React from 'react';

interface AnalysisProgressCardProps {
  current: number;
  total: number;
  percentage: number;
  overallAnalysisStatus?: 'idle' | 'analyzing' | 'completed' | 'error';
  overallAnalysisProgress?: string;
}

export const AnalysisProgressCard: React.FC<AnalysisProgressCardProps> = ({
  current, total, percentage,
  overallAnalysisStatus,
  overallAnalysisProgress,
}) => {
  return (
    <div className="glass p-6 rounded-2xl">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <span>🖥</span>
        AI分析中...
      </h3>

      {/* シーンフレーム分析 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            各シーン分析
          </span>
          <span className="text-sm font-bold text-white">{percentage}%</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-2.5 mb-1">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-zinc-500">
          シーン {current}/{total} を分析中...
        </p>
      </div>

      {/* 動画全体分析（音声込み） */}
      {overallAnalysisStatus && overallAnalysisStatus !== 'idle' && (
        <div className="pt-3 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                overallAnalysisStatus === 'completed' ? 'bg-emerald-400' :
                overallAnalysisStatus === 'error' ? 'bg-red-400' :
                'bg-purple-400 animate-pulse'
              }`}></span>
              動画全体分析（音声込み）
            </span>
            <span className={`text-xs font-bold ${
              overallAnalysisStatus === 'completed' ? 'text-emerald-400' :
              overallAnalysisStatus === 'error' ? 'text-red-400' :
              'text-purple-300'
            }`}>
              {overallAnalysisStatus === 'completed' ? '完了' :
               overallAnalysisStatus === 'error' ? 'エラー' : '分析中'}
            </span>
          </div>
          {overallAnalysisStatus === 'analyzing' && (
            <div className="w-full bg-zinc-800 rounded-full h-2 mb-1">
              <div className="bg-gradient-to-r from-purple-500 to-pink-400 h-2 rounded-full animate-pulse w-full"></div>
            </div>
          )}
          {overallAnalysisProgress && (
            <p className="text-xs text-zinc-500">{overallAnalysisProgress}</p>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-3">
        ※ 分析中でも下のフレームを確認できます
      </p>
    </div>
  );
};
