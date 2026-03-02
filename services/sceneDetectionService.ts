/**
 * シーン検出サービス
 * 優先: Python API (PySceneDetect) → フォールバック: JavaScript フレーム差分
 * 分析は geminiService.analyzeSceneFrames (Gemini 2.5 Flash) で行う
 */

import { detectCutTimestampsByFrameDiff } from '../utils/sceneDetector';

const SCENE_API_URL = (typeof process !== 'undefined' && process.env?.SCENE_API_URL) || 'http://localhost:8000';

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
  try {
    return await detectScenesViaPythonApi(file, onProgress);
  } catch (err) {
    console.warn('Python APIに接続できません。JavaScriptで検出します:', err);
    onProgress?.('フレーム差分でカットを検出中...');
    return detectCutTimestampsByFrameDiff(
      file,
      { intervalSec: 0.2, maxFrames: 800, thresholdSigma: 1.5, minCutIntervalSec: 0.3 },
      onProgress
    );
  }
};
