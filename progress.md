# 進捗ログ

## 2025-03-02 場面検出の精度改善

- [x] geminiService: プロンプト強化（同じ人物・場所・構図=1シーン、テロップ変化のみでは分割しない）
- [x] geminiService: 最小2秒間隔の後処理を追加（LLMの過剰分割をマージ）
- [x] geminiService: プロンプト再調整（漏れなく検出を優先、0〜N秒間のカットをすべて列挙するよう明示）
- [x] geminiService: テロップ・キャプションの切り替えを分割トリガーに追加、「コレだけ使ってりゃいい！」などの各テロップ出現を検出
- [x] geminiService: 最小間隔を1.5秒に緩和（テロップ切り替えの細かい分割に対応）
- [x] geminiService: プロンプト強化（見落とし防止、製品切り替え検出、目安シーン数、検出しすぎでよい）
- [x] geminiService: フォールバック補完（LLM検出が粗い場合に6秒間隔でサンプルを補完、分/5シーン未満で発動）
- [x] geminiService: 細かい分割のため最小間隔1秒に変更、補完条件を緩和（分/8シーン未満・4秒間隔・20秒以上で発動）
- [x] geminiService: さらに細分化（最小間隔0.8秒、補完: 分/15シーン未満・3秒間隔・15秒以上、テロップ例追加「ドラッグストアよく見ない？」等）
- [x] フレーム単位分析の導入（Agentic Vision相当の高精度検出）
  - videoFrameExtractor: `extractFramesAtFixedInterval` 追加（1.5秒→1秒間隔に変更、maxFrames 100）
  - geminiService: 1) フレーム抽出 → 2) 8フレームずつGemini 2.5 Proで分析 → 3) テロップ・カット変化を検出
  - バッチ境界の見落とし防止: 前バッチ最終フレームを次バッチ先頭に追加
  - プロンプト強化: 「みたいなの ある？」「ニキビ予防」「肌荒れケアできる」など具体例、製品オーバーレイ検出を追加
  - 最小間隔0.7秒、補完間隔2秒に変更

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
