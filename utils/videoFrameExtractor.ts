
import { SceneData } from '../types';

export interface FrameExtractionOptions {
  intervalSeconds: number;
  maxFrames: number;
  quality: number;
}

export interface ExtractionProgress {
  current: number;
  total: number;
  percentage: number;
}

const DEFAULT_OPTIONS: FrameExtractionOptions = {
  intervalSeconds: 1,
  maxFrames: 60,
  quality: 0.8,
};

const formatTimestamp = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const waitForEvent = (element: HTMLElement | HTMLVideoElement, event: string): Promise<void> =>
  new Promise((resolve) => {
    element.addEventListener(event, () => resolve(), { once: true });
  });

export const extractFrames = async (
  file: File,
  options: Partial<FrameExtractionOptions> = {},
  onProgress?: (progress: ExtractionProgress) => void
): Promise<{ frames: SceneData[]; duration: number; videoObjectUrl: string }> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const videoObjectUrl = URL.createObjectURL(file);

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = videoObjectUrl;

  await waitForEvent(video, 'loadedmetadata');
  // Ensure enough data is buffered for seeking
  if (video.readyState < 2) {
    await waitForEvent(video, 'canplay');
  }

  const duration = video.duration;

  // 動画全体をカバーするようにインターバルを自動調整
  // 例: 90秒の動画 / 最大60フレーム = 1.5秒間隔
  const naturalFrameCount = Math.ceil(duration / opts.intervalSeconds);
  const adjustedInterval = naturalFrameCount > opts.maxFrames
    ? duration / opts.maxFrames
    : opts.intervalSeconds;
  const totalFrames = Math.min(naturalFrameCount, opts.maxFrames);

  // Determine canvas dimensions from actual video dimensions
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d')!;

  const frames: SceneData[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const timestamp = i * adjustedInterval;
    if (timestamp >= duration) break;

    video.currentTime = timestamp;
    await waitForEvent(video, 'seeked');
    // Wait one frame for the video to render
    await new Promise((resolve) => requestAnimationFrame(resolve));

    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', opts.quality);

    frames.push({
      id: `scene_${i}_${Math.random().toString(36).substr(2, 6)}`,
      sceneNumber: i + 1,
      timestamp,
      timestampFormatted: formatTimestamp(timestamp),
      thumbnailDataUrl,
      isSelected: false,
      analysis: null,
      analysisStatus: 'pending',
    });

    onProgress?.({
      current: i + 1,
      total: totalFrames,
      percentage: Math.round(((i + 1) / totalFrames) * 100),
    });
  }

  return { frames, duration, videoObjectUrl };
};
