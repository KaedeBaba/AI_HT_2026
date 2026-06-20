"""
main.py
-------
FastAPI のサーバー本体。

役割はシンプルで、
  1. ブラウザから送られてきた画像を受け取る
  2. scoring.analyze_frame() に渡して判定する
  3. 結果(JSON)を返す
だけ。判定ロジックは scoring.py 側にあるので、点数の調整で
このファイルを触ることはほとんどない。

【重要】このサーバーはカメラを「開きません」。
        カメラは利用者のブラウザにあり、ブラウザが画像を送ってきます。
        下のテスト画面も、ブラウザ側のカメラを使っています。

ローカルで起動:
    pip install -r requirements.txt
    uvicorn main:app --reload
    → ブラウザで http://localhost:8000 を開くとテスト画面が出る
"""

import base64
import binascii

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import scoring

app = FastAPI(title="柔 - 緊張度判定API(雛形)")

# フロントが別URL(別Renderサービス)から呼べるように許可。
# 公開時は allow_origins を本番のフロントURLだけに絞ると安全。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    # "data:image/jpeg;base64,...." の文字列、または base64 本体だけでも可
    image: str


def _extract_base64(data_url: str) -> str:
    """data URL の "data:image/...;base64," 部分を取り除く。"""
    if data_url.strip().startswith("data:") and "," in data_url:
        return data_url.split(",", 1)[1]
    return data_url


@app.get("/health")
def health():
    """稼働確認用。"""
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    """画像を受け取り、緊張度の判定結果を返すメインのエンドポイント。"""
    try:
        image_bytes = base64.b64decode(_extract_base64(req.image))
    except (binascii.Error, ValueError):
        return {
            "face_detected": False, "score": None, "stage": None,
            "label": None, "action": None, "error": "画像の形式が不正です",
        }
    return scoring.analyze_frame(image_bytes)


@app.get("/", response_class=HTMLResponse)
def test_page():
    """
    動作確認用のテスト画面。
    自分のWebカメラの映像を一定間隔でこのサーバーに送り、返ってきた
    スコアと段階を画面に表示する。フロント担当の完成を待たずに、
    サーバー単体でパイプライン全体を確認できる。
    """
    return TEST_HTML


TEST_HTML = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>柔 - 判定テスト</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 24px auto; padding: 0 16px; color: #222; }
  h1 { font-size: 18px; }
  video { width: 100%; border-radius: 8px; background: #000; }
  .readout { margin-top: 12px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
  .label { font-size: 22px; font-weight: 600; }
  .muted { color: #777; font-size: 13px; }
  .slime { width: 120px; height: 120px; margin: 16px auto; border-radius: 50%;
           background: #ddd; transition: all .3s ease; }
  button { padding: 8px 14px; border-radius: 6px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
</style>
</head>
<body>
  <h1>柔 — 判定テスト画面（雛形）</h1>
  <p class="muted">ブラウザのカメラ映像を約3回/秒でサーバーに送り、返ってきた判定を表示します。</p>
  <video id="video" autoplay playsinline muted></video>
  <div class="slime" id="slime"></div>
  <div class="readout">
    <div class="label" id="label">カメラを許可してください</div>
    <div class="muted" id="detail">―</div>
  </div>
  <p><button id="toggle">停止</button></p>
  <canvas id="canvas" style="display:none"></canvas>

<script>
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const labelEl = document.getElementById('label');
const detailEl = document.getElementById('detail');
const slimeEl = document.getElementById('slime');
let running = true;

const SEND_W = 320; // サーバーに送る画像の横幅（小さくして軽量化）
const STAGE_COLOR = { 1:'#e07a5f', 2:'#e9b44c', 3:'#6ec6a8', 4:'#9bb8e0', 5:'#b9a3e3' };

async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    loop();
  } catch (e) {
    labelEl.textContent = 'カメラを使えませんでした';
    detailEl.textContent = e.message;
  }
}

async function analyzeOnce() {
  if (!video.videoWidth) return;
  const scale = SEND_W / video.videoWidth;
  canvas.width = SEND_W;
  canvas.height = Math.round(video.videoHeight * scale);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    });
    render(await res.json());
  } catch (e) {
    detailEl.textContent = '通信エラー: ' + e.message;
  }
}

function render(data) {
  if (!data.face_detected) {
    labelEl.textContent = '顔を探しています…';
    detailEl.textContent = 'カメラに顔を写してください';
    slimeEl.style.background = '#ddd';
    return;
  }
  labelEl.textContent = data.label + '（段階' + data.stage + '）';
  detailEl.textContent = '緊張スコア: ' + data.score + ' ／ 行き先: ' + data.action;
  // 段階に応じてスライム代わりの円を変化（硬い=小さめ＆角張る、柔らかい=大きめ）
  const size = 80 + data.stage * 14;
  slimeEl.style.width = size + 'px';
  slimeEl.style.height = size + 'px';
  slimeEl.style.borderRadius = (data.stage <= 1 ? '12%' : '50%');
  slimeEl.style.background = STAGE_COLOR[data.stage] || '#6ec6a8';
}

function loop() {
  if (running) analyzeOnce();
  setTimeout(loop, 300); // 約3回/秒
}

document.getElementById('toggle').addEventListener('click', (e) => {
  running = !running;
  e.target.textContent = running ? '停止' : '再開';
});

start();
</script>
</body>
</html>"""