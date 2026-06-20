"""
main.py
-------
FastAPI のサーバー本体。役割は2つ。

  (1) 3つの画面を配信する
        GET /        → static/index.html （主画面：かおスライム）
        GET /relax   → static/relax.html （リラックス：深呼吸）
        GET /katsu   → static/katsu.html （喝）
  (2) 画像を受け取って緊張度を判定して返す
        POST /api/analyze

判定ロジックは scoring.py 側にあるので、点数の調整でこのファイルを触ることはない。

【重要】このサーバーはカメラを開きません。
        カメラは利用者のブラウザにあり、ブラウザが画像を /api/analyze に送ってきます。

ローカルで起動:
    pip install -r requirements.txt
    uvicorn main:app --reload
    → ブラウザで http://localhost:8000 を開く
"""

import base64
import binascii
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import scoring

app = FastAPI(title="かおスライム - 緊張度判定API")

STATIC = Path(__file__).parent / "static"

# 全部このサーバーから配信するので普段はCORS不要だが、
# フロントを別URLに分ける場合に備えて許可しておく（公開時はURLを絞ると安全）。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    # "data:image/jpeg;base64,...." 形式、または base64 本体だけでも可
    image: str


def _extract_base64(data_url: str) -> str:
    if data_url.strip().startswith("data:") and "," in data_url:
        return data_url.split(",", 1)[1]
    return data_url


# ---- 画面の配信 -------------------------------------------------

@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/relax")
def relax():
    return FileResponse(STATIC / "relax.html")


@app.get("/katsu")
def katsu():
    return FileResponse(STATIC / "katsu.html")


# ---- 判定API ----------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    try:
        image_bytes = base64.b64decode(_extract_base64(req.image))
    except (binascii.Error, ValueError):
        return {"face_detected": False, "score": None, "stage": None,
                "label": None, "action": None, "error": "画像の形式が不正です"}
    return scoring.analyze_frame(image_bytes)