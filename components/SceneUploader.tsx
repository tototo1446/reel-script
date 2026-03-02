
import React, { useState, useCallback } from 'react';

interface SceneUploaderProps {
  onFileSelected: (file: File) => void;
  isExtracting: boolean;
  extractionProgress: {
    current: number;
    total: number;
    percentage: number;
    phase?: 'detecting' | 'extracting';
    status?: string;
  } | null;
}

export const SceneUploader: React.FC<SceneUploaderProps> = ({ onFileSelected, isExtracting, extractionProgress }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(prev => prev + 1);
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(prev => {
      const next = prev - 1;
      if (next <= 0) setIsDragOver(false);
      return Math.max(0, next);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(0);
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    const videoFile = files.find((f: File) => f.type.startsWith('video/'));
    if (videoFile) {
      onFileSelected(videoFile);
    }
  }, [onFileSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-3xl font-bold text-white mb-2 text-center">
        Instagram Reelのシーンを自動抽出
      </h2>
      <p className="text-zinc-400 text-sm mb-8 text-center">
        動画をアップロードして、重要なシーンを簡単に抽出・ダウンロード
      </p>

      {isExtracting && extractionProgress ? (
        <div className="w-full max-w-lg glass p-8 rounded-2xl text-center">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-bold mb-2">
            {extractionProgress.phase === 'detecting'
              ? (extractionProgress.status || 'カットを検出中...')
              : 'シーンを抽出中...'}
          </p>
          <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${extractionProgress.percentage}%` }}
            ></div>
          </div>
          <p className="text-zinc-400 text-xs">
            {extractionProgress.phase === 'detecting'
              ? 'カットを検出しています...'
              : `${extractionProgress.current} / ${extractionProgress.total} シーン (${extractionProgress.percentage}%)`}
          </p>
        </div>
      ) : (
        <div
          className={`w-full max-w-lg glass p-8 rounded-2xl transition-all ${
            isDragOver ? 'border-2 border-pink-500 bg-pink-500/5' : 'border-2 border-transparent'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 text-zinc-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-white font-medium mb-4">動画URLを入力 or ファイルをドロップ</p>

            <div className="w-full flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder="https://example.com/video.mp4"
                disabled
                className="flex-1 bg-zinc-900/80 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-500 outline-none cursor-not-allowed"
              />
              <div className="bg-zinc-800 rounded-lg p-2.5 text-zinc-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mb-4">または</p>

            <label className="w-full cursor-pointer">
              <div className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium text-center py-3 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-2">
                <span>📁</span>
                ファイルを選択
              </div>
              <input
                type="file"
                className="hidden"
                accept="video/mp4,video/quicktime"
                onChange={handleFileInput}
              />
            </label>
          </div>
        </div>
      )}

      {!isExtracting && (
        <p className="text-zinc-500 text-xs mt-4">MP4 / MOV形式に対応 (最大100MB)</p>
      )}
    </div>
  );
};
