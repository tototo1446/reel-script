"""
シーン検出API（PySceneDetect使用）
明確なカット割りのみ検出。分析はフロントエンドのGemini 2.5 Flashで行う。
"""
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from scenedetect import detect, ContentDetector, AdaptiveDetector

app = FastAPI(title="Scene Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect-scenes")
async def detect_scenes(
    file: UploadFile = File(...),
    detector: str = "reel",
    threshold: float = 11.0,
    min_scene_len: int = 5,
):
    """
    動画からカット検出し、タイムスタンプ（秒）のリストを返す。
    - detector: "reel" (デュアル検出・高感度) / "content" / "adaptive"
    - threshold: 閾値（content用、デフォルト11）
    - min_scene_len: 最小シーン長（フレーム数、デフォルト5≒30fpsで約0.17秒）
    """
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(400, "動画ファイルをアップロードしてください")

    with tempfile.NamedTemporaryFile(suffix=Path(file.filename or "video").suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if detector == "reel":
            # デュアルディテクタ: ContentDetector + AdaptiveDetector の結果をマージ
            content_scenes = detect(
                tmp_path,
                ContentDetector(threshold=threshold, min_scene_len=min_scene_len),
            )
            adaptive_scenes = detect(
                tmp_path,
                AdaptiveDetector(
                    adaptive_threshold=1.8,
                    min_scene_len=min_scene_len,
                    min_content_val=8.0,
                ),
            )
            # 両方のタイムスタンプをマージ
            raw_timestamps: set[float] = set()
            for scene_list in (content_scenes, adaptive_scenes):
                for start, _end in scene_list:
                    sec = start.get_seconds()
                    if sec > 0:
                        raw_timestamps.add(round(sec, 2))
            # ソートして 0.2秒未満の近接をフィルタ
            sorted_ts = sorted(raw_timestamps)
            timestamps = [0.0]
            for ts in sorted_ts:
                if ts - timestamps[-1] >= 0.2:
                    timestamps.append(ts)
        elif detector == "adaptive":
            scene_list = detect(tmp_path, AdaptiveDetector())
            timestamps = [0.0]
            for start, _end in scene_list:
                start_sec = start.get_seconds()
                if start_sec > 0 and (not timestamps or start_sec - timestamps[-1] >= 0.3):
                    timestamps.append(round(start_sec, 2))
        else:
            scene_list = detect(
                tmp_path,
                ContentDetector(threshold=threshold, min_scene_len=min_scene_len),
            )
            timestamps = [0.0]
            for start, _end in scene_list:
                start_sec = start.get_seconds()
                if start_sec > 0 and (not timestamps or start_sec - timestamps[-1] >= 0.3):
                    timestamps.append(round(start_sec, 2))

        return {"timestamps": sorted(set(timestamps))}
    finally:
        Path(tmp_path).unlink(missing_ok=True)
