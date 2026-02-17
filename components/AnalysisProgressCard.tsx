
import React from 'react';

interface AnalysisProgressCardProps {
  current: number;
  total: number;
  percentage: number;
}

export const AnalysisProgressCard: React.FC<AnalysisProgressCardProps> = ({ current, total, percentage }) => {
  return (
    <div className="glass p-6 rounded-2xl">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
        <span>🖥</span>
        AI分析中...
      </h3>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-zinc-400">各シーン分析中...</span>
        <span className="text-sm font-bold text-white">{percentage}%</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-2.5 mb-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="text-xs text-zinc-500">
        シーン {current}/{total} を分析中...
      </p>
      <p className="text-xs text-zinc-600 mt-2">
        ※ 分析中でも下のフレームを確認できます
      </p>
    </div>
  );
};
