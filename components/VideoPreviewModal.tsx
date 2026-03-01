
import React, { useRef } from 'react';
import { SceneData } from '../types';

interface VideoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoObjectUrl: string;
  scenes: SceneData[];
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  isOpen,
  onClose,
  videoObjectUrl,
  scenes,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  const jumpToScene = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
    }
  };

  const handlePlay = () => {
    videoRef.current?.play();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoObjectUrl;
    link.download = 'video.mp4';
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-2xl border border-zinc-700 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎬</span>
            元動画プレビュー
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="p-4">
          <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
            {videoObjectUrl ? (
              <video
                ref={videoRef}
                src={videoObjectUrl}
                controls
                className="max-h-[400px] w-auto mx-auto"
                playsInline
              />
            ) : (
              <p className="text-zinc-500 text-sm py-8">元動画は過去セッションでは利用できません</p>
            )}
          </div>

          {/* Action buttons */}
          {videoObjectUrl && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handlePlay}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              再生
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              動画をダウンロード
            </button>
          </div>
          )}

          {/* Scene Jump（動画がある場合のみ） */}
          {videoObjectUrl && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
              <span>🚀</span>
              検出されたシーンにジャンプ:
            </h4>
            <div className="flex flex-wrap gap-2">
              {scenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => jumpToScene(scene.timestamp)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono rounded-lg border border-zinc-700 transition-colors"
                >
                  {scene.timestampFormatted}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
