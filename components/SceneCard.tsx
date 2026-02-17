
import React from 'react';
import { SceneData } from '../types';

const TAG_COLORS = [
  'bg-pink-500/20 text-pink-300',
  'bg-blue-500/20 text-blue-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-purple-500/20 text-purple-300',
];

interface SceneCardProps {
  scene: SceneData;
  onSelect: (id: string) => void;
  onDownload: (scene: SceneData) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({ scene, onSelect, onDownload }) => {
  return (
    <div
      className={`rounded-xl overflow-hidden shadow-lg cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] ${
        scene.isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent' : ''
      }`}
      onClick={() => onSelect(scene.id)}
    >
      {/* Thumbnail Section */}
      <div className="relative aspect-[9/16]">
        <img
          src={scene.thumbnailDataUrl}
          alt={`シーン ${scene.sceneNumber}`}
          className="w-full h-full object-cover"
        />

        {/* Scene number badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-lg p-1.5">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="bg-zinc-900/80 backdrop-blur-sm text-white text-xs font-bold rounded-lg px-2 py-1">
            {scene.sceneNumber}
          </div>
        </div>

        {/* Timestamp badge */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs font-mono px-2 py-1 rounded">
          {scene.timestampFormatted}
        </div>

        {/* Download button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(scene); }}
          className="absolute bottom-2 right-2 bg-zinc-900/70 hover:bg-zinc-900/90 text-white rounded-full p-1.5 transition-colors opacity-0 group-hover:opacity-100"
          style={{ opacity: 1 }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        {/* Selection indicator */}
        {scene.isSelected && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Analysis Section */}
      <div className="bg-zinc-900/90 backdrop-blur-sm p-3 min-h-[60px]">
        {scene.analysisStatus === 'completed' && scene.analysis ? (
          <>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px]">🤖</span>
              <span className="text-[11px] font-bold text-white">AI分析</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-3 mb-2">
              {scene.analysis.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {scene.analysis.tags.slice(0, 4).map((tag, i) => (
                <span
                  key={i}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${TAG_COLORS[i % TAG_COLORS.length]}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        ) : scene.analysisStatus === 'analyzing' ? (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[11px] text-zinc-400">AI分析中...</span>
          </div>
        ) : scene.analysisStatus === 'error' ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-red-400">分析エラー</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-zinc-600 rounded-full"></div>
            <span className="text-[11px] text-zinc-500">AI分析中...</span>
          </div>
        )}
      </div>
    </div>
  );
};
