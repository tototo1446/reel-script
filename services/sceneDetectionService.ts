/**
 * シーン検出サービス
 * 優先: Python API (PySceneDetect) → フォールバック: JavaScript フレーム差分
 * 分析は geminiService.analyzeSceneFrames (Gemini 2.5 Flash) で行う
 *
 * カット戦略:
 *   - 冒頭5秒: 1秒間隔で強制カット（リールの掴みを確実に捉える）
 *   - 5秒以降: 場面切り替え・テロップ変化があった箇所のみカット
 *   - 最小間隔フィルタで重複・過剰カットを防止
 */

import { detectCutTimestampsByFrameDiff } from '../utils/sceneDetector';

const SCENE_API_URL = (typeof process !== 'undefined' && process.env?.SCENE_API_URL) || 'http://localhost:8000';

/** 動画の尺を取得 */
async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      resolve(v.duration);
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('動画メタデータ取得失敗'));
    };
  });
}

/**
 * タイムスタンプ後処理:
 * - 冒頭5秒: 1秒間隔で強制カット（重要な掴み部分を確実にキャプチャ）
 * - 5秒以降: シーン変化の検出ポイントのみ残す（最小間隔で重複防止）
 */
function postProcessTimestamps(rawTimestamps: number[], duration: number): number[] {
  const FORCED_SEC = 5;            // 冒頭何秒を強制カットするか
  const FORCED_INTERVAL = 1;       // 冒頭の強制カット間隔（秒）
  const MIN_INTERVAL_AFTER = 1.5;  // 5秒以降の最小カット間隔（秒）

  // Part 1: 冒頭5秒は1秒間隔で強制カット
  const forcedCuts: number[] = [];
  const maxForced = Math.min(FORCED_SEC, duration);
  for (let t = 0; t < maxForced; t += FORCED_INTERVAL) {
    forcedCuts.push(Math.round(t * 100) / 100);
  }

  // Part 2: 5秒以降はシーン変化の検出ポイントのみ残す
  const sceneChangeCuts = rawTimestamps
    .filter(t => t >= FORCED_SEC)
    .sort((a, b) => a - b);

  const filteredSceneCuts: number[] = [];
  let lastCut = forcedCuts.length > 0 ? forcedCuts[forcedCuts.length - 1] : 0;
  for (const t of sceneChangeCuts) {
    if (t - lastCut >= MIN_INTERVAL_AFTER) {
      filteredSceneCuts.push(t);
      lastCut = t;
    }
  }

  const result = [...forcedCuts, ...filteredSceneCuts];
  console.log(`[SceneDetection] 後処理: 生タイムスタンプ ${rawTimestamps.length}件 → ${result.length}件 (冒頭${forcedCuts.length} + シーン変化${filteredSceneCuts.length})`);
  return result;
}

/** Python APIでシーン検出（PySceneDetect） */
export const detectScenesViaPythonApi = async (
  file: File,
  onProgress?: (status: string) => void
): Promise<number[]> => {
  onProgress?.('Python APIでカットを検出中...');

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${SCENE_API_URL}/detect-scenes?detector=reel`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`シーン検出API エラー: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { timestamps: number[] };
  const timestamps = data.timestamps ?? [];
  return timestamps.length > 0 ? timestamps : [0];
};

/** シーン検出（Python API優先、失敗時はJSフォールバック） */
export const detectSceneTimestamps = async (
  file: File,
  onProgress?: (status: string) => void
): Promise<number[]> => {
  // 動画の尺を先に取得（後処理で使用）
  const duration = await getVideoDuration(file);

  let rawTimestamps: number[];
  try {
    rawTimestamps = await detectScenesViaPythonApi(file, onProgress);
  } catch (err) {
    console.warn('Python APIに接続できません。JavaScriptで検出します:', err);
    onProgress?.('フレーム差分でカットを検出中...');
    rawTimestamps = await detectCutTimestampsByFrameDiff(
      file,
      { intervalSec: 0.2, maxFrames: 800, thresholdSigma: 1.5, minCutIntervalSec: 0.3 },
      onProgress
    );
  }

  // 冒頭5秒は1秒間隔で強制カット、以降はシーン変化のみ
  return postProcessTimestamps(rawTimestamps, duration);
};
