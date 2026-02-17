
import React, { useRef } from 'react';
import { SceneData, SceneViewMode } from '../types';
import { SceneCard } from './SceneCard';

interface SceneGridProps {
  scenes: SceneData[];
  viewMode: SceneViewMode;
  onSelectScene: (id: string) => void;
  onDownloadScene: (scene: SceneData) => void;
}

export const SceneGrid: React.FC<SceneGridProps> = ({ scenes, viewMode, onSelectScene, onDownloadScene }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -400 : 400;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  if (viewMode === 'carousel') {
    return (
      <div className="relative">
        {/* Left arrow */}
        <button
          onClick={() => scrollBy('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full p-2 shadow-lg backdrop-blur-sm transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 px-8 snap-x snap-mandatory custom-scrollbar"
          style={{ scrollbarWidth: 'thin' }}
        >
          {scenes.map(scene => (
            <div key={scene.id} className="flex-shrink-0 w-[220px] snap-start">
              <SceneCard
                scene={scene}
                onSelect={onSelectScene}
                onDownload={onDownloadScene}
              />
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scrollBy('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full p-2 shadow-lg backdrop-blur-sm transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {scenes.map(scene => (
        <SceneCard
          key={scene.id}
          scene={scene}
          onSelect={onSelectScene}
          onDownload={onDownloadScene}
        />
      ))}
    </div>
  );
};
