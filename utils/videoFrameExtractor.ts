
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
  phase?: 'detecting' | 'extracting';
  status?: string;
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

/** 固定間隔でフレームを抽出（場面検出のフレーム単位分析用）。{ timestamp, dataUrl }[] を返す */
export const extractFramesAtFixedInterval = async (
  file: File,
  intervalSec: number,
  options: { quality?: number; maxFrames?: number } = {},
  onProgress?: (current: number, total: number) => void
): Promise<{ timestamp: number; dataUrl: string }[]> => {
  const quality = options.quality ?? 0.7;
  const maxFrames = options.maxFrames ?? 80;
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await waitForEvent(video, 'loadedmetadata');
  if (video.readyState < 2) await waitForEvent(video, 'canplay');

  const duration = video.duration;
  // 動画全長をカバーするよう間隔を調整（maxFrames超過時は間隔を広げる）
  const rawCount = Math.ceil(duration / intervalSec);
  const actualInterval = rawCount > maxFrames ? duration / maxFrames : intervalSec;
  const timestamps: number[] = [];
  for (let t = 0; t < duration && timestamps.length < maxFrames; t += actualInterval) {
    timestamps.push(Math.min(t, duration - 0.5));
  }
  if (timestamps.length === 0) timestamps.push(0);

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;

  const result: { timestamp: number; dataUrl: string }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    video.currentTime = t;
    await waitForEvent(video, 'seeked');
    await new Promise((r) => requestAnimationFrame(r));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    result.push({ timestamp: t, dataUrl: canvas.toDataURL('image/jpeg', quality) });
    onProgress?.(i + 1, timestamps.length);
  }
  URL.revokeObjectURL(url);
  return result;
};

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

/** 指定したタイムスタンプ（秒）の位置でフレームを抽出（LLM検出の場面切り替え用） */
export const extractFramesAtTimestamps = async (
  file: File,
  timestamps: number[],
  options: { quality?: number } = {},
  onProgress?: (progress: ExtractionProgress) => void
): Promise<{ frames: SceneData[]; duration: number; videoObjectUrl: string }> => {
  const quality = options.quality ?? 0.6;
  const videoObjectUrl = URL.createObjectURL(file);

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = videoObjectUrl;

  await waitForEvent(video, 'loadedmetadata');
  if (video.readyState < 2) {
    await waitForEvent(video, 'canplay');
  }

  const duration = video.duration;

  // 動画の長さを超えるタイムスタンプを除外し、ソート
  const validTimestamps = [...new Set(timestamps)]
    .filter((t) => t >= 0 && t < duration)
    .sort((a, b) => a - b);

  if (validTimestamps.length === 0) {
    // フォールバック: 0秒のみ
    validTimestamps.push(0);
  }

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d')!;

  const frames: SceneData[] = [];

  for (let i = 0; i < validTimestamps.length; i++) {
    const timestamp = validTimestamps[i];
    video.currentTime = timestamp;
    await waitForEvent(video, 'seeked');
    await new Promise((resolve) => requestAnimationFrame(resolve));

    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', quality);

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
      total: validTimestamps.length,
      percentage: Math.round(((i + 1) / validTimestamps.length) * 100),
      phase: 'extracting',
    });
  }

  return { frames, duration, videoObjectUrl };
};
