const video = document.getElementById('video');
const slimeCanvas = document.getElementById('slime-canvas');
const ctx = slimeCanvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const levelText = document.getElementById('level-text');
const messageEl = document.getElementById('message');
const actionBtn = document.getElementById('action-btn');

let currentLevel = 2;
let slimePoints = [];
let slimePhase = 0;
let detecting = false;
let smoothScore = 0.5;

const SLIME_SHAPES = ['current', 'circle', 'ellipse'];
const slimeShape = SLIME_SHAPES[Math.floor(Math.random() * SLIME_SHAPES.length)];

const LEVELS = {
  1: { label: 'カチカチ', color: '#888780', message: '少しリラックスしましょう😌', action: 'リラックスページへ', url: '/relax', dotClass: 'hard' },
  2: { label: 'ちょうどいい', color: '#5DCAA5', message: 'いい感じです！✨', action: null, dotClass: 'active' },
  3: { label: 'ダルダル', color: '#F0997B', message: 'しっかりしよう！💪', action: '喝ページへ', url: '/katsu', dotClass: 'soft' }
};

function initSlimePoints() {
  slimePoints = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    slimePoints.push({ angle, baseR: 55, r: 55, vr: 0 });
  }
}

function drawSlime() {
  const level = LEVELS[currentLevel];
  const hardness = currentLevel === 1 ? 0.95 : currentLevel === 3 ? 0.3 : 0.65;
  const wobble = currentLevel === 1 ? 0.3 : currentLevel === 3 ? 4.5 : 2.0;
  const speed = currentLevel === 1 ? 0.04 : currentLevel === 3 ? 0.025 : 0.035;

  slimePhase += speed;
  slimePoints.forEach((point, index) => {
    const wave = Math.sin(slimePhase * 2 + index * 0.5) * wobble
      + Math.sin(slimePhase * 3.1 + index * 0.9) * wobble * 0.5;
    const target = point.baseR + wave;
    point.vr = point.vr * hardness + (target - point.r) * (1 - hardness) * 8;
    point.r += point.vr;
  });

  ctx.clearRect(0, 0, 200, 160);
  const cx = 100;
  const cy = 88;
  const sway = Math.sin(slimePhase * 1.3) * (currentLevel === 3 ? 5 : 2);

  ctx.beginPath();
  if (slimeShape === 'circle') {
    const radiusX = 40 + Math.sin(slimePhase * 2.1) * 1.5;
    const radiusY = 40 + Math.cos(slimePhase * 1.8) * 1.2;
    ctx.ellipse(cx, cy + 8, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else if (slimeShape === 'ellipse') {
    const radiusX = 54 + Math.sin(slimePhase * 1.8) * 2.5;
    const radiusY = 32 + Math.cos(slimePhase * 1.6) * 1.5;
    ctx.ellipse(cx, cy + 10, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else {
    const tipLift = currentLevel === 1 ? 12 : currentLevel === 3 ? 10 : 11;
    const bodyWidth = 60 + (currentLevel === 1 ? 14 : currentLevel === 3 ? 22 : 18);
    const bodyHeight = 72 + (currentLevel === 1 ? 8 : currentLevel === 3 ? 14 : 10);

    ctx.moveTo(cx, cy - bodyHeight - tipLift);
    ctx.bezierCurveTo(
      cx + bodyWidth * 0.2 + sway,
      cy - bodyHeight * 0.76,
      cx + bodyWidth * 0.88,
      cy - bodyHeight * 0.1,
      cx + bodyWidth * 0.98,
      cy + bodyHeight * 0.22
    );
    ctx.bezierCurveTo(
      cx + bodyWidth * 1.04,
      cy + bodyHeight * 0.96,
      cx + bodyWidth * 0.42,
      cy + bodyHeight * 1.08,
      cx,
      cy + bodyHeight * 1.04
    );
    ctx.bezierCurveTo(
      cx - bodyWidth * 0.42,
      cy + bodyHeight * 1.08,
      cx - bodyWidth * 1.04,
      cy + bodyHeight * 0.96,
      cx - bodyWidth * 0.98,
      cy + bodyHeight * 0.22
    );
    ctx.bezierCurveTo(
      cx - bodyWidth * 0.88,
      cy - bodyHeight * 0.1,
      cx - bodyWidth * 0.2 - sway,
      cy - bodyHeight * 0.76,
      cx,
      cy - bodyHeight - tipLift
    );
  }
  ctx.fillStyle = level.color;
  ctx.fill();

  if (slimeShape === 'current') {
    const bodyHeight = 72 + (currentLevel === 1 ? 8 : currentLevel === 3 ? 14 : 10);
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - bodyHeight - 8);
    ctx.quadraticCurveTo(cx, cy - bodyHeight - 18, cx + 7, cy - bodyHeight - 8);
    ctx.quadraticCurveTo(cx, cy - bodyHeight - 14, cx - 7, cy - bodyHeight - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(cx - 10, cy - 6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 10, cy - 6, 6, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(cx - 10, cy - 6, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 10, cy - 6, 2.6, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  if (currentLevel === 1) {
    ctx.beginPath(); ctx.arc(cx, cy + 10, 8, 0, Math.PI, true); ctx.stroke();
  } else if (currentLevel === 3) {
    ctx.beginPath(); ctx.arc(cx, cy + 8, 8, 0, Math.PI); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy + 8, 8, 0, Math.PI); ctx.fill();
  }

  requestAnimationFrame(drawSlime);
}

function setLevel(level) {
  if (level === currentLevel) return;
  currentLevel = level;
  const info = LEVELS[level];
  levelText.textContent = info.label;
  messageEl.textContent = info.message;

  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`d${i}`);
    dot.className = 'dot';
    if (i <= level) dot.classList.add(info.dotClass);
  }

  if (info.action) {
    actionBtn.style.display = 'inline-block';
    actionBtn.textContent = info.action;
    actionBtn.dataset.url = info.url;
  } else {
    actionBtn.style.display = 'none';
  }
}

function handleAction() {
  if (actionBtn.dataset.url) {
    window.location.href = actionBtn.dataset.url;
  }
}

async function loadModels() {
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
  ]);
}

async function startCamera() {
  startBtn.style.display = 'none';
  startBtn.disabled = true;
  levelText.textContent = 'モデル読み込み中...';
  messageEl.textContent = 'カメラの準備中です';

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('このブラウザではカメラを使えません');
    }

    await loadModels();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    detecting = true;
    detectLoop();
    levelText.textContent = '検出中...';
    messageEl.textContent = '顔を映してください';
  } catch (error) {
    detecting = false;
    levelText.textContent = 'カメラエラー';
    messageEl.textContent = 'カメラの許可かモデル読み込みを確認してください';
    startBtn.style.display = 'block';
    startBtn.disabled = false;
    startBtn.textContent = '再試行';
    console.error(error);
  }
}

async function detectLoop() {
  if (!detecting) return;

  try {
    const result = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (result) {
      const expressions = result.expressions;
      const hardScore = (expressions.angry || 0) + (expressions.disgusted || 0) + (expressions.fearful || 0) * 0.5 + (expressions.neutral || 0) * 0.3;
      const softScore = (expressions.happy || 0) + (expressions.surprised || 0) * 0.5 + (expressions.sad || 0) * 0.3;
      const raw = softScore - hardScore + 0.5;
      const clamped = Math.max(0, Math.min(1, raw));
      smoothScore = smoothScore * 0.85 + clamped * 0.15;

      const nextLevel = smoothScore < 0.35 ? 1 : smoothScore > 0.65 ? 3 : 2;
      setLevel(nextLevel);
    }
  } catch (error) {
    // ignore and keep looping
  }

  setTimeout(detectLoop, 300);
}

startBtn.addEventListener('click', startCamera);
initSlimePoints();
setLevel(2);
drawSlime();
window.handleAction = handleAction;
