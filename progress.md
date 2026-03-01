# 進捗ログ

## 2025-03-02 場面検出の精度改善（同じカットの細かい分割を防止）

- [x] geminiService: プロンプト強化（同じ人物・場所・構図=1シーン、テロップ変化のみでは分割しない）
- [x] geminiService: 最小2秒間隔の後処理を追加（LLMの過剰分割をマージ）

## 2025-02-26 シーン分割LLM化

- [x] geminiService: `detectSceneChangeTimestamps` 追加
- [x] videoFrameExtractor: `extractFramesAtTimestamps` 追加
- [x] App.tsx: 抽出フローをLLM検出→タイムスタンプ指定に変更
- [x] SceneUploader: 検出フェーズのUI表示対応
- [x] フォールバック: LLM失敗時は5秒間隔で抽出

## 2025-02-26 分析結果の履歴保存・振り返り

- [x] SessionHistoryList: 過去セッション一覧UI
- [x] loadSessionFromHistory: 履歴から復元
- [x] handleDeleteSessionFromHistory: 履歴削除
- [x] SceneHeader: 戻るボタン・動画なし時は「元動画を見る」非表示
- [x] VideoPreviewModal: 動画なし時の表示対応
