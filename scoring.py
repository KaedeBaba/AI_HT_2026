"""
scoring.py
----------
顔の検出と「緊張スコア」の計算をまとめたモジュール。

サーバー本体(main.py)からは、このファイルの analyze_frame() だけを呼ぶ。
スコアの中身を良くしたいときは、このファイルの compute_tension_score() を
書き換えるだけでよい（main.py は触らなくてよい）。

※ いまの compute_tension_score() は「仮の点数」です。
   本物の判定にするには、顔ランドマーク(dlib や MediaPipe)を使って
   眉・目・口の形から計算する処理に置き換えてください。
"""

import cv2
import numpy as np

# OpenCV に同梱されている学習済みカスケード（追加ダウンロード不要）
_face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# 5段階の定義（緊張スコアが高いほど「硬い」）
# action は「フロントがどの画面に進むか」の合図。
STAGES = [
    {"min": 80, "stage": 1, "label": "カチカチ",     "action": "relax"},      # 硬すぎ → リラックスページ
    {"min": 60, "stage": 2, "label": "かため",       "action": "hint_relax"}, # メインで軽い声かけ
    {"min": 40, "stage": 3, "label": "ちょうどいい", "action": "ok"},         # そのまま
    {"min": 20, "stage": 4, "label": "ゆるめ",       "action": "hint_wake"},  # メインで軽い声かけ
    {"min": 0,  "stage": 5, "label": "ダルダル",     "action": "wake"},       # 柔らかすぎ → 喝ページ
]


def decode_image(image_bytes: bytes):
    """受け取ったバイト列を OpenCV の画像(ndarray)に変換する。失敗したら None。"""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_face(gray):
    """グレースケール画像から一番大きい顔を1つ返す。見つからなければ None。"""
    faces = _face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )
    if len(faces) == 0:
        return None
    # 一番大きい(=手前にある)顔を採用
    return max(faces, key=lambda f: f[2] * f[3])


def compute_tension_score(gray, face) -> float:
    """
    緊張スコア(0〜100)を返す。100に近いほど緊張(=硬い)。

    ▼▼▼ ここが差し替えポイント ▼▼▼
    いまは「仮の計算」です。顔の上部(眉のあたり)の明暗のばらつきを
    使っているだけで、本物の緊張判定ではありません。
    （動作確認用に、顔を動かすと数値が変わるようにしてあります。）

    本番では dlib / MediaPipe で眉・目・口のランドマークを取り、
      ・眉の下がり具合
      ・目の開き具合(EAR = eye aspect ratio)
      ・唇の結び具合
    などから点数を作ってください。
    ▲▲▲ ここが差し替えポイント ▲▲▲
    """
    x, y, w, h = face
    # 眉〜目のあたりの帯を切り出す（顔の上から20〜45%あたり）
    brow = gray[y + int(h * 0.20): y + int(h * 0.45), x: x + w]
    if brow.size == 0:
        return 50.0
    # 明暗のばらつき(標準偏差)を 0〜100 にざっくり変換（※あくまで仮）
    score = (float(brow.std()) - 20.0) * 2.5
    return float(np.clip(score, 0, 100))


def score_to_stage(score: float) -> dict:
    """スコアを5段階の情報に変換する。"""
    for s in STAGES:
        if score >= s["min"]:
            return s
    return STAGES[-1]


def analyze_frame(image_bytes: bytes) -> dict:
    """
    画像バイト列を受け取り、判定結果を辞書で返す。
    main.py からはこの関数だけを呼べばよい。
    """
    img = decode_image(image_bytes)
    if img is None:
        return {
            "face_detected": False, "score": None, "stage": None,
            "label": None, "action": None, "error": "画像を読み込めませんでした",
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face = detect_face(gray)
    if face is None:
        return {
            "face_detected": False, "score": None, "stage": None,
            "label": None, "action": None,
        }

    score = compute_tension_score(gray, face)
    stage = score_to_stage(score)
    x, y, w, h = (int(v) for v in face)
    return {
        "face_detected": True,
        "score": round(score, 1),
        "stage": stage["stage"],
        "label": stage["label"],
        "action": stage["action"],
        "face_box": {"x": x, "y": y, "w": w, "h": h},
    }