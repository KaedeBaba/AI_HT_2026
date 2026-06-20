import base64
import binascii
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import scoring

app = FastAPI(title="かおスライム - 緊張度判定API")

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# 同一オリジン運用では不要だが、将来フロントを分離する場合に備えて許可。
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
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/index.html")
def index_html():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/app.js")
def app_js():
    return FileResponse(STATIC_DIR / "app.js")


@app.get("/style.css")
def style_css():
    return FileResponse(STATIC_DIR / "style.css")


@app.get("/relax")
def relax():
    return FileResponse(TEMPLATES_DIR / "relax.html")


@app.get("/katsu")
def katsu():
    return FileResponse(TEMPLATES_DIR / "katsu.html")


# ---- 判定API ----------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    try:
        image_bytes = base64.b64decode(_extract_base64(req.image))
    except (binascii.Error, ValueError):
        return {
            "face_detected": False,
            "score": None,
            "stage": None,
            "label": None,
            "action": None,
            "error": "画像の形式が不正です",
        }

    return scoring.analyze_frame(image_bytes)
