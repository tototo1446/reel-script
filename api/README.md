# シーン検出API（PySceneDetect）

動画からカット検出を行うPython API。分析はフロントエンドのGemini 2.5 Flashで行う。

## セットアップ

```bash
cd api
pip install -r requirements.txt
```

## 起動

```bash
uvicorn main:app --reload --port 8000
```

またはプロジェクトルートから:

```bash
npm run api
```

## エンドポイント

- `GET /health` - ヘルスチェック
- `POST /detect-scenes` - 動画ファイルをアップロードし、カット検出のタイムスタンプ（秒）を返す

## 環境変数

フロントエンドの `SCENE_API_URL` でAPIのURLを指定（デフォルト: http://localhost:8000）
