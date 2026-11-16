import './fonts.css';
import './style.css';

/* =========================================================
 *  설정
 * ======================================================= */
const SP = 8; // 저해상도(픽셀아트) 기준 교차점 간격(px)
const STONE_INTERVAL = 55; // 돌 하나 놓는 간격(ms)
const DROP_MS = 150; // 돌이 떨어지는 시간
const ZOOM_DELAY = 550; // 마지막 돌 이후 줌 시작까지
const ZOOM_MS = 1900;

// 3x5 숫자를 "획 순서"대로 놓기 위한 좌표 목록
const DIGITS = {
  0: [[0,0],[1,0],[2,0],[2,1],[2,2],[2,3],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1]],
  2: [[0,0],[1,0],[2,0],[2,1],[2,2],[1,2],[0,2],[0,3],[0,4],[1,4],[2,4]],
  5: [[2,0],[1,0],[0,0],[0,1],[0,2],[1,2],[2,2],[2,3],[2,4],[1,4],[0,4]],
  7: [[0,0],[1,0],[2,0],[2,1],[2,2],[2,3],[2,4]],
  9: [[2,2],[1,2],[0,2],[0,1],[0,0],[1,0],[2,0],[2,1],[2,3],[2,4],[1,4],[0,4]],
};
const LINES = ['2027', '05', '29'];
const TEXT_W = 15; // "2027" = 4*3 + 3칸 간격
const TEXT_H = 19; // 5 + 2 + 5 + 2 + 5

// 텍스트 블록 안에서의 돌 좌표(순서대로)
const STONES = [];
LINES.forEach((line, li) => {
  const w = line.length * 3 + (line.length - 1);
  const x0 = Math.floor((TEXT_W - w) / 2);
  [...line].forEach((ch, di) => {
    for (const [x, y] of DIGITS[ch]) {
      STONES.push({ c: x0 + di * 4 + x, r: li * 7 + y });
    }
  });
});
// 마지막 숫자 "9"의 중심 (텍스트 블록 좌표)
const NINE = { c: Math.floor((TEXT_W - 7) / 2) + 4 + 1, r: 14 + 2 };

/* =========================================================
 *  캔버스 & 레이아웃
 * ======================================================= */
const view = document.getElementById('board');
const vctx = view.getContext('2d');
const low = document.createElement('canvas');
const lctx = low.getContext('2d');
const boardLayer = document.createElement('canvas');
const bctx = boardLayer.getContext('2d');

let L = null; // 현재 레이아웃

function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = Math.round(window.innerWidth * dpr);
  const H = Math.round(window.innerHeight * dpr);
  view.width = W;
  view.height = H;

  // 최소 19 x 23 교차점이 화면에 들어가도록 정수 배율 선택
  // 배율이 크면 정수로 맞춰 픽셀을 고르게, 작으면(저해상도 화면) 소수 배율로 칸 수 유지
  const f = Math.min(W / 19, H / 23) / SP;
  const s = f >= 4 ? Math.floor(f) : Math.max(1, f);
  const lowW = Math.ceil(W / s);
  const lowH = Math.ceil(H / s);
  const cols = Math.floor((lowW - SP) / SP) + 1;
  const rows = Math.floor((lowH - SP) / SP) + 1;
  const ox = Math.floor((lowW - (cols - 1) * SP) / 2);
  const oy = Math.floor((lowH - (rows - 1) * SP) / 2);
  const tc = Math.floor((cols - TEXT_W) / 2);
  const tr = Math.floor((rows - TEXT_H) / 2);

  low.width = boardLayer.width = lowW;
  low.height = boardLayer.height = lowH;

  L = { W, H, s, lowW, lowH, cols, rows, ox, oy, tc, tr };
  drawBoard();
}

const px = (c) => L.ox + c * SP;
const py = (r) => L.oy + r * SP;

/* ---------- 결정적 난수 (나뭇결이 리사이즈해도 동일하게) ---------- */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WOOD = ['#e2b468', '#d9a75a', '#cf9a4c', '#c48d42'];
const LINE = '#5b3a17';

function drawBoard() {
  const { lowW, lowH, cols, rows } = L;
  const img = bctx.createImageData(lowW, lowH);
  const rand = rng(20270529);
  const rgb = WOOD.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  for (let y = 0; y < lowH; y++) {
    const grain = Math.sin(y * 0.55 + Math.sin(y * 0.07) * 3);
    for (let x = 0; x < lowW; x++) {
      const n = grain * 0.9 + Math.sin(x * 0.04 + y * 0.01) * 0.4 + (rand() - 0.5) * 1.1;
      const k = n > 0.9 ? 0 : n > -0.2 ? 1 : n > -0.9 ? 2 : 3;
      const o = (y * lowW + x) * 4;
      img.data[o] = rgb[k][0];
      img.data[o + 1] = rgb[k][1];
      img.data[o + 2] = rgb[k][2];
      img.data[o + 3] = 255;
    }
  }
  bctx.putImageData(img, 0, 0);

  // 격자선
  bctx.fillStyle = LINE;
  for (let c = 0; c < cols; c++) bctx.fillRect(px(c), py(0), 1, (rows - 1) * SP + 1);
  for (let r = 0; r < rows; r++) bctx.fillRect(px(0), py(r), (cols - 1) * SP + 1, 1);
  // 테두리는 한 번 더 굵게
  bctx.fillRect(px(0) - 1, py(0) - 1, (cols - 1) * SP + 3, 1);
  bctx.fillRect(px(0) - 1, py(rows - 1) + 1, (cols - 1) * SP + 3, 1);
  bctx.fillRect(px(0) - 1, py(0) - 1, 1, (rows - 1) * SP + 3);
  bctx.fillRect(px(cols - 1) + 1, py(0) - 1, 1, (rows - 1) * SP + 3);

  // 화점(별점)
  const cc = Math.floor((cols - 1) / 2);
  const rc = Math.floor((rows - 1) / 2);
  for (let c = cc % 6; c < cols; c += 6) {
    for (let r = rc % 6; r < rows; r += 6) {
      if (c < 3 || r < 3 || c > cols - 4 || r > rows - 4) continue;
      bctx.fillRect(px(c) - 1, py(r) - 1, 3, 3);
    }
  }
}

/* ---------- 바둑돌 스프라이트 (7x7) ---------- */
const STONE = [
  '..kkk..',
  '.kmmkk.',
  'kmhmkkk',
  'kmmkkkk',
  'kkkkkkd',
  '.kkkkd.',
  '..kdd..',
];
const STONE_COL = { k: '#1d1d22', m: '#3a3a44', h: '#8c8c99', d: '#0b0b0d' };

function drawSprite(ctx, cx, cy, color) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ch = STONE[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = color || STONE_COL[ch];
      ctx.fillRect(cx - 3 + x, cy - 3 + y, 1, 1);
    }
  }
}

/* =========================================================
 *  사운드 (WebAudio로 직접 합성)
 * ======================================================= */
let audio = null;
function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* 사운드 미지원 */ }
}

function clack() {
  if (!audio || audio.state !== 'running') return;
  const t = audio.currentTime;
  const len = Math.floor(audio.sampleRate * 0.05);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = audio.createBufferSource();
  src.buffer = buf;
  const bp = audio.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 + Math.random() * 600;
  bp.Q.value = 3;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.9, t);
  src.connect(bp).connect(g).connect(audio.destination);
  src.start(t);
}

function blip(freq = 880, dur = 0.025, vol = 0.04) {
  if (!audio || audio.state !== 'running') return;
  const t = audio.currentTime;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.01);
}

/* =========================================================
 *  애니메이션
 * ======================================================= */
const shade = document.getElementById('shade');
const hint = document.getElementById('hint');
const consoleEl = document.getElementById('console');
const screen = document.getElementById('screen');

let phase = 'idle'; // idle → placing → zooming → console
let t0 = 0;
let placedSounds = 0;

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function start() {
  unlockAudio();
  if (phase !== 'idle') return;
  phase = 'placing';
  t0 = performance.now();
  hint.classList.add('gone');
}

function frame(now) {
  const { W, H, s, lowW, lowH, tc, tr } = L;
  const elapsed = phase === 'idle' ? -1 : now - t0;

  // 1) 저해상도 캔버스에 판 + 돌
  lctx.drawImage(boardLayer, 0, 0);
  for (let i = 0; i < STONES.length; i++) {
    const t = elapsed - i * STONE_INTERVAL;
    if (t < 0) break;
    const x = px(tc + STONES[i].c);
    const y = py(tr + STONES[i].r);
    const p = clamp01(t / DROP_MS);
    const lift = Math.round((1 - p) * (1 - p) * 9);
    drawSprite(lctx, x + 1, y + 1, 'rgba(70,35,5,.45)'); // 그림자
    drawSprite(lctx, x, y - lift);
    if (p >= 1 && i >= placedSounds) {
      placedSounds = i + 1;
      clack();
    }
  }

  // 2) 카메라 (9로 줌인)
  const zoomStart = STONES.length * STONE_INTERVAL + DROP_MS + ZOOM_DELAY;
  const zp = easeInOut(clamp01((elapsed - zoomStart) / ZOOM_MS));
  const nx = px(tc + NINE.c);
  const ny = py(tr + NINE.r);
  const nineH = 4 * SP + 7;
  const zEnd = Math.max(1, Math.min((0.42 * H) / (nineH * s), (0.62 * W) / (3 * SP * s)));
  const z = 1 + (zEnd - 1) * zp;
  const k = s * z;
  // 줌이 끝나면 "9"가 화면 위쪽 30% 지점에 오도록
  const targetY = ny + ((0.5 - 0.3) * H) / k;
  const camX = lowW / 2 + (nx - lowW / 2) * zp;
  const camY = lowH / 2 + (targetY - lowH / 2) * zp;

  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.fillStyle = '#2a1a08';
  vctx.fillRect(0, 0, W, H);
  vctx.imageSmoothingEnabled = false;
  vctx.setTransform(k, 0, 0, k, Math.round(W / 2 - camX * k), Math.round(H / 2 - camY * k));
  vctx.drawImage(low, 0, 0);

  shade.style.opacity = (zp * 0.45).toFixed(3);

  if (phase === 'placing' && elapsed >= zoomStart) phase = 'zooming';
  if (phase === 'zooming' && elapsed >= zoomStart + ZOOM_MS * 0.8) {
    phase = 'console';
    runConsole();
  }

  requestAnimationFrame(frame);
}

/* =========================================================
 *  콘솔창
 * ======================================================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function line(cls = '') {
  const el = document.createElement('div');
  el.className = 'line ' + cls;
  screen.appendChild(el);
  return el;
}

async function type(el, text, speed = 45, sound = true) {
  for (const ch of text) {
    el.append(ch);
    if (sound && ch !== ' ') blip(700 + Math.random() * 300);
    await sleep(speed);
  }
}

function pixelHeart() {
  const shape = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 7 6');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('class', 'heart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '하트');
  shape.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', 1); r.setAttribute('height', 1);
    r.setAttribute('fill', x === 1 && y === 1 ? '#ffb3c0' : 'var(--heart)');
    svg.appendChild(r);
  }));
  return svg;
}

async function runConsole() {
  consoleEl.hidden = false;
  consoleEl.classList.add('pop');
  blip(330, 0.08, 0.05);
  await sleep(500);

  const cmd = line();
  cmd.append('C:\\WEDDING> ');
  await type(cmd, 'invite.exe --open', 55);
  await sleep(250);

  const load = line('dim');
  load.textContent = 'loading ';
  for (let i = 0; i <= 10; i++) {
    load.textContent = 'loading [' + '█'.repeat(i) + '·'.repeat(10 - i) + '] ' + i * 10 + '%';
    blip(440 + i * 40, 0.02, 0.03);
    await sleep(70);
  }
  await sleep(250);

  const names = line('names');
  await type(names, '홍진혁', 140);
  await sleep(150);
  names.appendChild(pixelHeart());
  blip(990, 0.12, 0.05);
  await sleep(300);
  await type(names, '이슬기', 140);
  await sleep(350);

  const date = line('date');
  await type(date, '2027. 05. 29 (토) 오후 2시', 40, false);
  await sleep(150);

  const venue = line('date venue');
  await type(venue, '의정부 경민컨벤션 아모리스홀', 70);
  await sleep(200);

  const prompt = line();
  prompt.append('C:\\WEDDING> ');
  const cur = document.createElement('span');
  cur.className = 'cursor';
  prompt.appendChild(cur);
}

/* =========================================================
 *  시작
 * ======================================================= */
layout();
window.addEventListener('resize', layout);
requestAnimationFrame(frame);

// 아무 곳이나 터치 / 스크롤 시도 / 키 입력 → 시작
for (const ev of ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'keydown']) {
  window.addEventListener(ev, start, { passive: true });
}
