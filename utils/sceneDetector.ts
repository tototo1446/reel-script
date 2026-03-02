/**
 * フレーム差分によるカット検出（LLM不要・トークン節約・高速）
 * 明確なカット割り（映像の切り替わり）のみを検出。テロップ変化は検出しない。
 */

const waitForEvent = (el: HTMLVideoElement, ev: string): Promise<void> =>
  new Promise((r) => el.addEventListener(ev, () => r(), { once: true }));

/** 2フレーム間の平均絶対差分（グレースケール、0-255） */
function computeFrameDiff(img1: ImageData, img2: ImageData): number {
  const d = img1.data;
  const d2 = img2.data;
  let sum = 0;
  const step = 4; // RGBA、全ピクセルだと重いので間引く場合: step=8 など
  for (let i = 0; i < d.length; i += step) {
    const g1 = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const g2 = 0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2];
    sum += Math.abs(g1 - g2);
  }
  return sum / (d.length / step);
}

/** フレーム差分でカット検出。明確なカット割りのみ検出（テロップ変化は検出しない） */
export const detectCutTimestampsByFrameDiff = async (
  file: File,
  options: {
    intervalSec?: number;
    maxFrames?: number;
    /** 差分閾値（未指定時は統計的閾値: 平均 + thresholdSigma * 標準偏差） */
    thresholdSigma?: number;
    /** 最小カット間隔（秒） */
    minCutIntervalSec?: number;
  } = {},
  onProgress?: (status: string) => void
): Promise<number[]> => {
  const intervalSec = options.intervalSec ?? 0.5;
  const maxFrames = options.maxFrames ?? 400;
  const thresholdSigma = options.thresholdSigma ?? 2.5;
  const minCutIntervalSec = options.minCutIntervalSec ?? 1;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await waitForEvent(video, 'loadedmetadata');
  if (video.readyState < 2) await waitForEvent(video, 'canplay');

  const duration = video.duration;
  const rawCount = Math.ceil(duration / intervalSec);
  const actualInterval = rawCount > maxFrames ? duration / maxFrames : intervalSec;

  const timestamps: number[] = [];
  for (let t = 0; t < duration && timestamps.length < maxFrames; t += actualInterval) {
    timestamps.push(Math.min(t, duration - 0.5));
  }
  if (timestamps.length === 0) timestamps.push(0);

  // 解像度を下げて高速化（幅160程度）
  const scale = Math.min(1, 160 / video.videoWidth);
  const w = Math.max(1, Math.floor(video.videoWidth * scale));
  const h = Math.max(1, Math.floor(video.videoHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const imageDataList: { timestamp: number; data: ImageData }[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    video.currentTime = t;
    await waitForEvent(video, 'seeked');
    await new Promise((r) => requestAnimationFrame(r));
    ctx.drawImage(video, 0, 0, w, h);
    imageDataList.push({ timestamp: t, data: ctx.getImageData(0, 0, w, h) });
    onProgress?.(`フレーム取得中 (${i + 1}/${timestamps.length})...`);
  }
  URL.revokeObjectURL(url);

  if (imageDataList.length < 2) return [0];

  // 差分を計算
  const diffs: number[] = [];
  for (let i = 1; i < imageDataList.length; i++) {
    diffs.push(computeFrameDiff(imageDataList[i - 1].data, imageDataList[i].data));
  }

  // 統計的閾値: 平均 + thresholdSigma * 標準偏差
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / diffs.length;
  const std = Math.sqrt(variance);
  const threshold = mean + thresholdSigma * std;

  if (std < 1) return [0]; // ほぼ変化がない動画

  const cutTimestamps: number[] = [0];
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i] >= threshold) {
      const cut = imageDataList[i + 1].timestamp;
      if (cut - cutTimestamps[cutTimestamps.length - 1] >= minCutIntervalSec) {
        cutTimestamps.push(cut);
      }
    }
  }

  return cutTimestamps;
};
