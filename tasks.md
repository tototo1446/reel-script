# シーン分割 LLM化 実装計画

## 目的
秒数ベースの等間隔分割 → LLMで場面切り替えを検出して分割

## 変更対象

| ファイル | 変更内容 |
|----------|----------|
| `services/geminiService.ts` | 動画から場面切り替え秒数を検出するAPI追加 |
| `utils/videoFrameExtractor.ts` | 指定タイムスタンプでフレーム抽出する関数追加 |
| `App.tsx` | 抽出フローを「LLM検出→タイムスタンプ指定抽出」に変更 |

## ステップ

1. **geminiService**: `detectSceneChangeTimestamps(file, onProgress)` を追加
   - 動画をアップロードし、Geminiに「場面が切り替わった秒数」を返すよう依頼
   - 返却形式: `{ timestamps: number[] }`（例: [0, 5.2, 12.3, 25.8]）
   - 0秒は必ず含める（最初のシーン）

2. **videoFrameExtractor**: `extractFramesAtTimestamps(file, timestamps, options)` を追加
   - 既存の `extractFrames` のロジックを流用し、等間隔ではなく指定秒数でフレーム取得

3. **App.tsx**: `handleSceneExtraction` を変更
   - 1) `detectSceneChangeTimestamps` で秒数取得
   - 2) `extractFramesAtTimestamps` でフレーム抽出
   - フォールバック: LLM失敗時は5秒間隔で抽出（実装済）

4. **場面検出の精度改善**（2025-03-02）
   - プロンプト強化: 同じ人物・同じ場所・同じ構図が続く場合は1シーン、テロップ変化だけでは分割しない
   - 後処理: 最小2秒間隔を強制し、LLMが細かく分割しすぎた場合にマージ

---

# シーン検出Python化・分析はFlash（2025-03-02）

- [x] api/: PySceneDetectによるシーン検出API（FastAPI）
- [x] sceneDetectionService: Python API優先、失敗時はJSフレーム差分でフォールバック
- [x] geminiService: LLMシーン検出を削除、analyzeSceneFrames（Gemini 2.5 Flash）のみ残す


## 目的
動画分析結果を履歴として保存し、過去セッションを振り返りやすくする

## 変更対象

| ファイル | 変更内容 |
|----------|----------|
| `components/SessionHistoryList.tsx` | 新規: 過去セッション一覧UI |
| `App.tsx` | 履歴読み込み・戻る・削除ハンドラー |
| `components/SceneHeader.tsx` | 過去セッション時は「元動画」非表示 |
| `components/VideoPreviewModal.tsx` | 動画なし時の表示対応 |
