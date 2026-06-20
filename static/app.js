const video = document.getElementById('video');
const slimeCanvas = document.getElementById('slime-canvas');
const slimeCtx = slimeCanvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const levelText = document.getElementById('level-text');
const messageEl = document.getElementById('message');
const actionBtn = document.getElementById('action-btn');

const captureCanvas = document.createElement('canvas');
const captureCtx = captureCanvas.getContext('2d');

const LEVELS = {
  1: {
    label: 'カチカチ',
    color: '#888780',
    message: '少しリラックスしましょう',
    actionText: 'リラックスページへ',
    actionUrl: '/relax',
    dotClass: 'hard',
  },
  2: {
    label: 'ちょうどいい',
    color: '#5DCAA5',
    message: 'いい感じです',
    actionText: null,
    actionUrl: null,
    dotClass: 'active',
  },
  3: {
    label: 'ダルダル',
    color: '#F0997B',
    message: 'しっかりしよう',
    actionText: '喝ページへ',
    actionUrl: '/katsu',
    dotClass: 'soft',
  },
};

const ACTION_TO_LEVEL = {
  relax: 1,
  hint_relax: 1,
  ok: 2,
  hint_wake: 3,
  wake: 3,
};

let currentLevel = null;
let slimePoints = [];
let slimePhase = 0;
let running = false;
let captureTimerId = null;

function initSlimePoints() {
  slimePoints = [];
  const count = 24;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    slimePoints.push({ angle, baseR: 55, r: 55, vr: 0 });
  }
}

function drawSlime() {
  const level = LEVELS[currentLevel ?? 2];
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

  slimeCtx.clearRect(0, 0, 200, 160);
  const cx = 100;
  const cy = 88;

  slimeCtx.beginPath();
  for (let i = 0; i < slimePoints.length; i += 1) {
    const point = slimePoints[i];
    const x = cx + Math.cos(point.angle) * point.r;
    const y = cy + Math.sin(point.angle) * point.r * 0.85;
    if (i === 0) {
      slimeCtx.moveTo(x, y);
    } else {
      slimeCtx.lineTo(x, y);
    }
  }
  slimeCtx.closePath();
  slimeCtx.fillStyle = level.color;
  slimeCtx.fill();

  slimeCtx.fillStyle = 'rgba(255,255,255,0.9)';
  slimeCtx.beginPath();
  slimeCtx.arc(cx - 14, cy - 8, 7, 0, Math.PI * 2);
  slimeCtx.fill();
  slimeCtx.beginPath();
  slimeCtx.arc(cx + 14, cy - 8, 7, 0, Math.PI * 2);
  slimeCtx.fill();

  slimeCtx.fillStyle = '#333';
  slimeCtx.beginPath();
  slimeCtx.arc(cx - 14, cy - 7, 3, 0, Math.PI * 2);
  slimeCtx.fill();
  slimeCtx.beginPath();
  slimeCtx.arc(cx + 14, cy - 7, 3, 0, Math.PI * 2);
  slimeCtx.fill();

  slimeCtx.strokeStyle = '#333';
  slimeCtx.lineWidth = 2;
  if (currentLevel === 1) {
    slimeCtx.beginPath();
    slimeCtx.arc(cx, cy + 14, 10, 0, Math.PI, true);
    slimeCtx.stroke();
  } else {
    slimeCtx.beginPath();
    slimeCtx.arc(cx, cy + 12, 10, 0, Math.PI);
    slimeCtx.fill();
  }

  requestAnimationFrame(drawSlime);
}

function setLevel(level) {
  const info = LEVELS[level];
  if (!info) {
    return;
  }

  currentLevel = level;
  levelText.textContent = info.label;
  messageEl.textContent = info.message;

  for (let i = 1; i <= 3; i += 1) {
    const dot = document.getElementById(`d${i}`);
    dot.className = 'dot';
    if (i <= level) {
      dot.classList.add(info.dotClass);
    }
  }

  if (info.actionText && info.actionUrl) {
    actionBtn.style.display = 'inline-block';
    actionBtn.textContent = info.actionText;
    actionBtn.dataset.url = info.actionUrl;
  } else {
    actionBtn.style.display = 'none';
    actionBtn.dataset.url = '';
  }
}

function handleAction() {
  const url = actionBtn.dataset.url;
  if (url) {
    window.location.href = url;
  }
}

function mapResultToLevel(result) {
  if (!result || !result.face_detected) {
    return null;
  }

  if (result.action && ACTION_TO_LEVEL[result.action]) {
    return ACTION_TO_LEVEL[result.action];
  }

  if (typeof result.stage === 'number') {
    if (result.stage <= 2) {
      return 1;
    }
    if (result.stage === 3) {
      return 2;
    }
    return 3;
  }

  return null;
}

async function analyzeOnce() {
  if (!video.videoWidth || !running) {
    return;
  }

  const sendWidth = 320;
  const scale = sendWidth / video.videoWidth;
  captureCanvas.width = sendWidth;
  captureCanvas.height = Math.round(video.videoHeight * scale);
  captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.7);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.face_detected) {
      levelText.textContent = '顔を探しています...';
      messageEl.textContent = result.error || 'カメラに顔を映してください';
      actionBtn.style.display = 'none';
      return;
    }

    const mappedLevel = mapResultToLevel(result);
    if (mappedLevel) {
      setLevel(mappedLevel);
    }

    messageEl.textContent = `スコア: ${result.score} / 判定: ${result.label}`;
  } catch (error) {
    levelText.textContent = '通信エラー';
    messageEl.textContent = 'APIとの接続に失敗しました';
    console.error(error);
  }
}

function startAnalyzeLoop() {
  if (captureTimerId) {
    clearInterval(captureTimerId);
  }

  captureTimerId = setInterval(() => {
    analyzeOnce();
  }, 350);
}

async function startCamera() {
  startBtn.style.display = 'none';
  startBtn.disabled = true;
  levelText.textContent = 'カメラ起動中...';
  messageEl.textContent = '許可ダイアログを確認してください';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    running = true;
    levelText.textContent = '解析中...';
    messageEl.textContent = '顔をカメラに映してください';
    startAnalyzeLoop();
  } catch (error) {
    running = false;
    levelText.textContent = 'カメラエラー';
    messageEl.textContent = error.message || 'カメラにアクセスできませんでした';
    startBtn.style.display = 'block';
    startBtn.disabled = false;
    startBtn.textContent = '再試行';
    console.error(error);
  }
}

startBtn.addEventListener('click', startCamera);
window.handleAction = handleAction;

initSlimePoints();
setLevel(2);
drawSlime();
