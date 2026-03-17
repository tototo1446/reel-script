/**
 * フレーム差分によるカット検出（LLM不要・トークン節約・高速）
 * 3つのメトリクスを併用して高精度にシーン変化を検出:
 *   1. グローバル平均差分 — 明確なカット割り
 *   2. ブロック分割MAX差分 — テロップ出現等の局所変化
 *   3. カラーヒストグラム距離 — 色調変化・照明変化
 */

const waitForEvent = (el: HTMLVideoElement, ev: string): Promise<void> =>
  new Promise((r) => el.addEventListener(ev, () => r(), { once: true }));

/** 2フレーム間の平均絶対差分（グレースケール、0-255） */
function computeGlobalDiff(img1: ImageData, img2: ImageData): number {
  const d1 = img1.data;
  const d2 = img2.data;
  let sum = 0;
  const step = 4;
  for (let i = 0; i < d1.length; i += step) {
    const g1 = 0.299 * d1[i] + 0.587 * d1[i + 1] + 0.114 * d1[i + 2];
    const g2 = 0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2];
    sum += Math.abs(g1 - g2);
  }
  return sum / (d1.length / step);
}

/** ブロック分割MAX差分 — フレームをグリッドに分割し、最大ブロック差分を返す */
function computeBlockMaxDiff(
  img1: ImageData, img2: ImageData,
  w: number, h: number, gridSize: number
): number {
  const d1 = img1.data;
  const d2 = img2.data;
  const bw = Math.ceil(w / gridSize);
  const bh = Math.ceil(h / gridSize);
  let maxBlockDiff = 0;

  for (let by = 0; by < gridSize; by++) {
    for (let bx = 0; bx < gridSize; bx++) {
      let blockSum = 0;
      let blockCount = 0;
      const startY = by * bh;
      const endY = Math.min(startY + bh, h);
      const startX = bx * bw;
      const endX = Math.min(startX + bw, w);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * w + x) * 4;
          const g1 = 0.299 * d1[idx] + 0.587 * d1[idx + 1] + 0.114 * d1[idx + 2];
          const g2 = 0.299 * d2[idx] + 0.587 * d2[idx + 1] + 0.114 * d2[idx + 2];
          blockSum += Math.abs(g1 - g2);
          blockCount++;
        }
      }
      if (blockCount > 0) {
        maxBlockDiff = Math.max(maxBlockDiff, blockSum / blockCount);
      }
    }
  }
  return maxBlockDiff;
}

/** カラーヒストグラム距離（RGB各チャンネル32ビン、バタチャリヤ距離） */
function computeHistogramDist(img1: ImageData, img2: ImageData): number {
  const bins = 32;
  const binSize = 256 / bins;
  const hist1R = new Float32Array(bins);
  const hist1G = new Float32Array(bins);
  const hist1B = new Float32Array(bins);
  const hist2R = new Float32Array(bins);
  const hist2G = new Float32Array(bins);
  const hist2B = new Float32Array(bins);
  const d1 = img1.data;
  const d2 = img2.data;
  const pixelCount = d1.length / 4;

  for (let i = 0; i < d1.length; i += 4) {
    const b1r = Math.min(bins - 1, (d1[i] / binSize) | 0);
    const b1g = Math.min(bins - 1, (d1[i + 1] / binSize) | 0);
    const b1b = Math.min(bins - 1, (d1[i + 2] / binSize) | 0);
    const b2r = Math.min(bins - 1, (d2[i] / binSize) | 0);
    const b2g = Math.min(bins - 1, (d2[i + 1] / binSize) | 0);
    const b2b = Math.min(bins - 1, (d2[i + 2] / binSize) | 0);
    hist1R[b1r]++; hist1G[b1g]++; hist1B[b1b]++;
    hist2R[b2r]++; hist2G[b2g]++; hist2B[b2b]++;
  }

  // 正規化してバタチャリヤ係数を計算
  let bc = 0;
  for (let ch = 0; ch < 3; ch++) {
    const h1 = ch === 0 ? hist1R : ch === 1 ? hist1G : hist1B;
    const h2 = ch === 0 ? hist2R : ch === 1 ? hist2G : hist2B;
    let channelBc = 0;
    for (let b = 0; b < bins; b++) {
      channelBc += Math.sqrt((h1[b] / pixelCount) * (h2[b] / pixelCount));
    }
    bc += channelBc;
  }
  bc /= 3;

  // バタチャリヤ距離 (0=同一, 1=完全に異なる)
  return Math.sqrt(Math.max(0, 1 - bc));
}

/** 統計的閾値を計算 (mean + sigma * std) */
function computeStatThreshold(values: number[], sigma: number): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, d) => a + (d - mean) ** 2, 0) / values.length;
  return mean + sigma * Math.sqrt(variance);
}

/** パーセンタイル値を計算 (0-1) */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

/** ローカルスパイク検出 — スライディングウィンドウ内の中央値の倍率でスパイクを判定 */
function detectLocalSpikes(values: number[], windowSize: number, spikeRatio: number): Set<number> {
  const spikes = new Set<number>();
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const window = values.slice(start, end).sort((a, b) => a - b);
    const localMedian = window[Math.floor(window.length / 2)];
    // 局所中央値の spikeRatio 倍以上なら局所スパイク
    if (localMedian > 0 && values[i] >= localMedian * spikeRatio) {
      spikes.add(i);
    }
  }
  return spikes;
}

/** フレーム差分でカット検出（3メトリクス + ローカルスパイク + パーセンタイル併用） */
export const detectCutTimestampsByFrameDiff = async (
  file: File,
  options: {
    intervalSec?: number;
    maxFrames?: number;
    thresholdSigma?: number;
    minCutIntervalSec?: number;
  } = {},
  onProgress?: (status: string) => void
): Promise<number[]> => {
  const intervalSec = options.intervalSec ?? 0.2;
  const maxFrames = options.maxFrames ?? 800;
  const thresholdSigma = options.thresholdSigma ?? 1.5;
  const minCutIntervalSec = options.minCutIntervalSec ?? 0.3;

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

  // 解像度: 幅256pxでテロップも捉える
  const scale = Math.min(1, 256 / video.videoWidth);
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

  // 3メトリクスを計算（早期打ち切り付き: globalDiffが低い安定フレームはblock/histogramをスキップ）
  const globalDiffs: number[] = [];
  const blockMaxDiffs: number[] = [];
  const histDists: number[] = [];
  const GRID_SIZE = 8;

  // Phase 1: globalDiffを全フレームで計算
  onProgress?.('シーン変化を解析中...');
  for (let i = 1; i < imageDataList.length; i++) {
    const prev = imageDataList[i - 1].data;
    const curr = imageDataList[i].data;
    globalDiffs.push(computeGlobalDiff(prev, curr));
  }

  // globalDiffの統計値から早期打ち切り閾値を決定（平均の50%未満は安定シーン）
  const globalMean = globalDiffs.reduce((a, b) => a + b, 0) / globalDiffs.length;
  const earlySkipThreshold = globalMean * 0.5;

  // Phase 2: globalDiffが閾値以上のフレームのみblock/histogramを計算
  for (let i = 1; i < imageDataList.length; i++) {
    const idx = i - 1;
    if (globalDiffs[idx] < earlySkipThreshold) {
      // 安定フレーム: 重い計算をスキップし、低い値を入れる
      blockMaxDiffs.push(0);
      histDists.push(0);
    } else {
      const prev = imageDataList[i - 1].data;
      const curr = imageDataList[i].data;
      blockMaxDiffs.push(computeBlockMaxDiff(prev, curr, w, h, GRID_SIZE));
      histDists.push(computeHistogramDist(prev, curr));
    }
  }

  // --- 検出手法1: グローバル統計的閾値 (mean + sigma * std) ---
  const globalThreshold = computeStatThreshold(globalDiffs, thresholdSigma);
  const blockThreshold = computeStatThreshold(blockMaxDiffs, thresholdSigma);
  const histThreshold = computeStatThreshold(histDists, thresholdSigma);

  const cutSet = new Set<number>();
  for (let i = 0; i < globalDiffs.length; i++) {
    if (
      globalDiffs[i] >= globalThreshold ||
      blockMaxDiffs[i] >= blockThreshold ||
      histDists[i] >= histThreshold
    ) {
      cutSet.add(i);
    }
  }

  // --- 検出手法2: パーセンタイル閾値 (上位15%を自動的にカット候補) ---
  const globalP85 = percentile(globalDiffs, 0.85);
  const blockP85 = percentile(blockMaxDiffs, 0.85);
  const histP85 = percentile(histDists, 0.85);
  for (let i = 0; i < globalDiffs.length; i++) {
    if (
      globalDiffs[i] >= globalP85 ||
      blockMaxDiffs[i] >= blockP85 ||
      histDists[i] >= histP85
    ) {
      cutSet.add(i);
    }
  }

  // --- 検出手法3: ローカルスパイク検出 (局所的な急変) ---
  const SPIKE_WINDOW = 9;
  const SPIKE_RATIO = 2.0;
  const globalSpikes = detectLocalSpikes(globalDiffs, SPIKE_WINDOW, SPIKE_RATIO);
  const blockSpikes = detectLocalSpikes(blockMaxDiffs, SPIKE_WINDOW, SPIKE_RATIO);
  const histSpikes = detectLocalSpikes(histDists, SPIKE_WINDOW, SPIKE_RATIO);
  for (const spike of globalSpikes) cutSet.add(spike);
  for (const spike of blockSpikes) cutSet.add(spike);
  for (const spike of histSpikes) cutSet.add(spike);

  // 最小間隔フィルタ
  const cutTimestamps: number[] = [0];
  const sortedIndices = [...cutSet].sort((a, b) => a - b);
  for (const i of sortedIndices) {
    const cut = imageDataList[i + 1].timestamp;
    if (cut - cutTimestamps[cutTimestamps.length - 1] >= minCutIntervalSec) {
      cutTimestamps.push(cut);
    }
  }

  return cutTimestamps;
};
