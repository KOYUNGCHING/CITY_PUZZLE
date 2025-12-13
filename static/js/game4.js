// ==========================================================
// game4.js（塔防遊戲｜科技版｜中文註解完整版｜波次遞增＋怪越來越硬）
// ----------------------------------------------------------
// 核心規則：
// 1) 點格子放塔（花費金幣）
// 2) 敵人沿最短路徑走到右側基地（終點），漏怪扣生命
// 3) 你的塔會打敵人；敵人出生塔（起點）也會打你的塔
// 4) 你的塔有 HP，被出生塔打到 0 會被摧毀
// 5) 敵人不能穿過你的塔：放塔時會驗證路徑，堵死就拒絕
// 6) 出怪仍是波次：小波→中波→大波→循環，但會越來越多、越來越快、越來越硬
// ==========================================================

/* =========================
   0) 基本設定 (Config)
   ========================= */
const COLS = 15;
const ROWS = 10;

// 起點=敵方出生塔，終點=我方基地
const START = { x: 0, y: Math.floor(ROWS / 2) };
const END = { x: COLS - 1, y: Math.floor(ROWS / 2) };

// 顯示路徑提示（格子上淡淡標記）
const SHOW_PATH_HINT = true;

/* ---- 玩家塔 (Player Towers) ---- */
const TOWER_COST = 40;            // 放塔花費（你要 50）
const TOWER_RANGE = 3;            // 射程（格子）
const TOWER_COOLDOWN = 0.55;      // 攻擊冷卻（秒）
const TOWER_DAMAGE = 18;          // 傷害
const TOWER_MAX_HP = 70;          // 塔耐久（被敵出生塔打會扣）
const TOWER_HIT_FLASH_MS = 120;   // 被打閃紅時間（毫秒）

/* ---- 敵方出生塔 (Enemy Spawn Base Turret) ---- */
const ENEMY_TOWER_RANGE = 7;      // 出生塔攻擊射程（格子）
const ENEMY_TOWER_COOLDOWN = 0.85;
const ENEMY_TOWER_DAMAGE = 14;

/* ---- 敵人 (Enemies) ---- */
const ENEMY_BASE_HP = 120;        // 敵人基礎血量
const ENEMY_SPEED = 2.6;          // 速度（格子/秒）
const GOLD_PER_KILL = 8;          // 擊殺金幣
const SCORE_PER_KILL = 20;        // 擊殺得分
const LIFE_LOSS_ON_LEAK = 1;      // 漏怪扣生命

/* ---- 波次模板：小→中→大 循環（基底，不寫死最終難度） ---- */
const WAVE_PATTERN = [
  { name: "小波", baseCount: 6, baseInterval: 1.25 },
  { name: "中波", baseCount: 10, baseInterval: 1.05 },
  { name: "大波", baseCount: 16, baseInterval: 0.85 }
];

const WAVE_REST_TIME = 4.0; // 每波打完休息幾秒

/* ---- 難度遞增參數（你只要調這裡） ----
   - count：每波怪數量增加
   - interval：每波出怪間隔縮短（越來越快），但有下限避免失控
   - hp：每波怪血量以比例成長（越來越硬，壓力更有感）
*/
const COUNT_GROWTH = 0.12;      // 每波數量成長率（0.12 = +12% / 波）
const INTERVAL_DECAY = 0.05;    // 每波間隔縮短率（0.05 = -5% / 波）
const MIN_INTERVAL = 0.35;      // 出怪間隔下限（秒）

const HP_GROWTH = 0.08;         // 每波血量成長率（0.08 = +8% / 波）
const HP_CAP = 1200;            // 血量上限（防止太誇張，可自行調整）

function getWaveConfig(waveNum, patternIndex) {
  const base = WAVE_PATTERN[patternIndex];

  // 數量：線性放大（穩定可控）
  const countScale = 1 + COUNT_GROWTH * (waveNum - 1);
  const count = Math.max(1, Math.round(base.baseCount * countScale));

  // 間隔：線性縮短（越來越快），並限制下限
  const intervalScale = 1 - INTERVAL_DECAY * (waveNum - 1);
  const interval = Math.max(MIN_INTERVAL, base.baseInterval * intervalScale);

  return { name: base.name, count, interval };
}

// 敵人血量：比例成長（越來越硬）
function getEnemyHp(waveNum) {
  // hp = base * (1 + HP_GROWTH*(wave-1))
  // 這是線性成長；你也可以改成乘法成長（更陡）但容易爆
  const hp = Math.round(ENEMY_BASE_HP * (1 + HP_GROWTH * (waveNum - 1)));
  return Math.min(HP_CAP, hp);
}

/* ---- 我方基地 (右側終點繪圖) ---- */
const BASE = {
  width: 60,
  height: 120,
  glowRadius: 90
};

/* =========================
   1) 遊戲狀態 (State)
   ========================= */
let running = false;
let paused = false;

let gold = 120;
let life = 20;
let score = 0;
let wave = 1;

// 波次控制（循環狀態機）
let waveActive = false;        // 正在出怪中？
let waveToSpawn = 0;           // 本波總怪數
let waveSpawned = 0;           // 本波已出怪數
let betweenWaveTimer = 0;      // 波與波之間倒數
let wavePatternIndex = 0;      // 0=小波 1=中波 2=大波

// 塔 / 敵人列表
let towers = [];   // {id,x,y,range2,cooldown,lastShot,damage,hp,maxHp,flashUntil}
let enemies = [];  // {id,x,y,hp,maxHp,path,pathIdx,progress,alive,color}

let nextTowerId = 1;
let nextEnemyId = 1;

// 格子阻擋：true 代表此格有塔（不可通行）
let gridBlocked = [];

// 目前從 START 到 END 的最短路徑（BFS 算）
let currentPath = null;

// 時間控制
let lastTime = 0;
let spawnAcc = 0; // 累積時間，用來判定何時出下一隻怪

// 敵方出生塔狀態（射擊用）
let enemyBase = {
  x: START.x,
  y: START.y,
  range2: ENEMY_TOWER_RANGE * ENEMY_TOWER_RANGE,
  cooldown: ENEMY_TOWER_COOLDOWN,
  lastShot: -Infinity
};

// Beam 光束特效（短暫存在）
let beams = []; // {x1,y1,x2,y2,t0,color,width,alpha}

// DOM cell cache
let cellEls = [];

/* =========================
   2) 取得 DOM
   ========================= */
const gridEl = document.getElementById("grid");
const unitsEl = document.getElementById("units");
const canvas = document.getElementById("uCanvas");
const ctx = canvas.getContext("2d");

// HUD
const scoreEl = document.getElementById("score");
const goldEl = document.getElementById("gold");
const lifeEl = document.getElementById("life");
const waveEl = document.getElementById("wave");
const aliveEl = document.getElementById("alive");
const msgEl = document.getElementById("msg");

// 按鈕 / 說明視窗（若你 HTML 有這些 id 就會啟用）
const howBtn = document.getElementById("howBtn");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const overlay = document.getElementById("overlay");
const closeHow = document.getElementById("closeHow");
const startHow = document.getElementById("startHow");

// 提示字
const DEFAULT_HINT = "提示：點空白格放塔（花費金幣）；若堵死路徑或讓現有敵人無路可走會被拒絕。注意左側敵人出生塔會轟你的塔！";

/* =========================
   3) HUD / 訊息
   ========================= */
function updateHUD() {
  scoreEl && (scoreEl.textContent = String(score));
  goldEl && (goldEl.textContent = String(gold));
  lifeEl && (lifeEl.textContent = String(life));
  waveEl && (waveEl.textContent = String(wave));
  aliveEl && (aliveEl.textContent = String(enemies.filter(e => e.alive).length));
}

let msgTimer = null;
function flashMsg(text) {
  if (!msgEl) return;
  msgEl.textContent = text;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { msgEl.textContent = DEFAULT_HINT; }, 2400);
}

function openHow() {
  if (!overlay) return;
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
}
function closeHowModal() {
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
}

/* =========================
   4) 幾何 / 工具
   ========================= */
function idx(x, y) { return y * COLS + x; }
function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

function getCellMetrics() {
  // 讀 CSS 變數 --cell --gap（若沒有就用預設值）
  const styles = getComputedStyle(document.documentElement);
  const cell = parseFloat(styles.getPropertyValue("--cell")) || 46;
  const gap = parseFloat(styles.getPropertyValue("--gap")) || 6;
  return { cell, gap };
}

function gridToPixelCenter(x, y) {
  const { cell, gap } = getCellMetrics();
  return {
    x: x * (cell + gap) + cell / 2,
    y: y * (cell + gap) + cell / 2
  };
}

function resizeCanvas() {
  const rect = unitsEl.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
}

/* =========================
   5) BFS 最短路徑（4 方向）
   - gridBlocked = true 的格子不可走
   ========================= */
function bfsPath(start, goal) {
  const q = [];
  const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  q.push(start);
  seen[start.y][start.x] = true;

  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 }
  ];

  while (q.length) {
    const cur = q.shift();
    if (cur.x === goal.x && cur.y === goal.y) break;

    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (!inBounds(nx, ny)) continue;
      if (seen[ny][nx]) continue;
      if (gridBlocked[ny][nx]) continue;

      seen[ny][nx] = true;
      prev[ny][nx] = cur;
      q.push({ x: nx, y: ny });
    }
  }

  if (!seen[goal.y][goal.x]) return null;

  // 回溯路徑
  const path = [];
  let cur = goal;
  while (!(cur.x === start.x && cur.y === start.y)) {
    path.push(cur);
    cur = prev[cur.y][cur.x];
  }
  path.push(start);
  path.reverse();
  return path;
}

/* =========================
   6) 繪圖：外星人 / 血條 / 光束 / 基地
   ========================= */
function drawAlien(x, y, r, color = "#9369ffff") {
  // 圓臉
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  const eyeOffset = r * 0.45;
  const eyeR = r * 0.25;

  function drawEye(cx, cy) {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#000000";
    ctx.arc(cx, cy, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEye(x - eyeOffset, y - r * 0.1);
  drawEye(x + eyeOffset, y - r * 0.1);

  // 觸角（兩隻）
  const antennaY = y - r * 1.1;
  const ballR = r * 0.18;

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.18);

  ctx.beginPath();
  ctx.moveTo(x - r * 0.35, y - r * 0.4);
  ctx.lineTo(x - r * 0.55, antennaY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + r * 0.35, y - r * 0.4);
  ctx.lineTo(x + r * 0.55, antennaY);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x - r * 0.55, antennaY, ballR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x + r * 0.55, antennaY, ballR, 0, Math.PI * 2);
  ctx.fill();
}

function drawHPBar(px, py, r, hp, maxHp, color = "rgba(120,255,160,0.65)") {
  const { cell } = getCellMetrics();
  const w = cell * 0.72;
  const h = 6;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px - w / 2, py - r - 14, w, h);

  ctx.fillStyle = color;
  ctx.fillRect(px - w / 2, py - r - 14, w * ratio, h);
  ctx.globalAlpha = 1.0;
}

// 光束：加一條短暫線段
function addBeam(x1, y1, x2, y2, color = "rgba(255,230,120,0.85)", width = 3, alpha = 0.9) {
  beams.push({ x1, y1, x2, y2, t0: performance.now(), color, width, alpha });
}

function renderBeams() {
  const now = performance.now();
  beams = beams.filter(b => now - b.t0 < 140);

  for (const b of beams) {
    const age = (now - b.t0) / 140;
    const a = Math.max(0, (b.alpha ?? 1) * (1 - age));
    ctx.globalAlpha = a;
    ctx.lineWidth = b.width ?? 3;
    ctx.strokeStyle = b.color ?? "rgba(255,230,120,0.85)";
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// 兼容性：有些瀏覽器沒有 ctx.roundRect
function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 在 Canvas 上畫我方基地（右側終點）
function drawBaseOnCanvas() {
  const center = gridToPixelCenter(END.x, END.y);
  const cx = center.x;
  const cy = center.y;

  const w = BASE.width;
  const h = BASE.height;

  ctx.save();

  // 外圈發光
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, BASE.glowRadius);
  glow.addColorStop(0, "rgba(120,255,220,0.25)");
  glow.addColorStop(0.6, "rgba(120,255,220,0.08)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, BASE.glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // 主體
  const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  grad.addColorStop(0, "rgba(10,26,42,0.95)");
  grad.addColorStop(0.5, "rgba(24,60,86,0.95)");
  grad.addColorStop(1, "rgba(10,26,42,0.95)");

  ctx.fillStyle = grad;
  ctx.strokeStyle = "rgba(120,255,230,0.85)";
  ctx.lineWidth = 2;

  roundRectPath(cx - w / 2, cy - h / 2, w, h, 14);
  ctx.fill();
  ctx.stroke();

  // 中央核心
  ctx.beginPath();
  ctx.fillStyle = "rgba(120,255,230,0.95)";
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();

  // 能量條
  ctx.strokeStyle = "rgba(120,255,230,0.55)";
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 6, cy + i * 18);
    ctx.lineTo(cx + w / 2 - 6, cy + i * 18);
    ctx.stroke();
  }

  ctx.restore();
}

// Canvas 主渲染：基地 + 敵人 + 塔血條 + 光束
function renderAllCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 先畫基地
  drawBaseOnCanvas();

  const { cell } = getCellMetrics();
  const r = cell * 0.31;

  // 畫敵人
  for (const e of enemies) {
    if (!e.alive) continue;
    const p = gridToPixelCenter(e.x, e.y);
    drawAlien(p.x, p.y, r, e.color);
    drawHPBar(p.x, p.y, r, e.hp, e.maxHp);
  }

  // 畫塔的血條（塔會被打爆）
  for (const t of towers) {
    const p = gridToPixelCenter(t.x, t.y);
    const flash = performance.now() < (t.flashUntil ?? 0);
    drawHPBar(
      p.x, p.y,
      r * 0.75,
      t.hp, t.maxHp,
      flash ? "rgba(255,120,120,0.75)" : "rgba(120,200,255,0.55)"
    );
  }

  // 光束最後畫（最顯眼）
  renderBeams();
}

/* =========================
   7) 建立格子 (Grid)
   ========================= */
function initGrid() {
  gridEl.innerHTML = "";
  cellEls = [];
  gridBlocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      // 起點 / 終點特殊樣式
      if (x === START.x && y === START.y) cell.classList.add("start", "enemyBase");
      if (x === END.x && y === END.y) cell.classList.add("end", "playerBase");

      cell.addEventListener("click", onCellClick);

      gridEl.appendChild(cell);
      cellEls.push(cell);
    }
  }

  // 起點/終點裝飾
  paintEnemyBaseCell(START.x, START.y);
  paintPlayerBaseCell(END.x, END.y);
}

// 起點：敵方出生塔 DOM 裝飾
function paintEnemyBaseCell(x, y) {
  const cell = cellEls[idx(x, y)];
  cell.querySelectorAll(".enemyBaseArt").forEach(n => n.remove());

  const art = document.createElement("div");
  art.className = "enemyBaseArt";
  art.innerHTML = `
    <div class="enemyPulse"></div>
    <div class="enemyCore"></div>
    <div class="enemyBarrel"></div>
  `;
  cell.appendChild(art);
}

// 終點：我方基地 DOM 裝飾
function paintPlayerBaseCell(x, y) {
  const cell = cellEls[idx(x, y)];
  cell.querySelectorAll(".playerBaseArt").forEach(n => n.remove());

  const art = document.createElement("div");
  art.className = "playerBaseArt";
  art.innerHTML = `
    <div class="baseGlow"></div>
    <div class="baseCore"></div>
    <div class="basePanel"></div>
  `;
  cell.appendChild(art);
}

// 塔：DOM 裝飾
function paintTowerCell(x, y) {
  const cell = cellEls[idx(x, y)];
  cell.classList.add("tower");
  cell.querySelectorAll(".towerArt").forEach(n => n.remove());

  const art = document.createElement("div");
  art.className = "towerArt";
  art.innerHTML = `
    <div class="towerGlow"></div>
    <div class="towerBase"></div>
    <div class="towerCore"></div>
    <div class="towerBarrel"></div>
  `;
  cell.appendChild(art);
}

// 塔被摧毀時視覺效果
function clearTowerCell(x, y) {
  const cell = cellEls[idx(x, y)];
  cell.classList.remove("tower");
  cell.classList.add("towerDestroyed");
  cell.querySelectorAll(".towerArt").forEach(n => n.remove());
  setTimeout(() => cell.classList.remove("towerDestroyed"), 220);
}

/* =========================
   8) 塔資料結構 / 射擊
   ========================= */
function makeTower(x, y) {
  return {
    id: nextTowerId++,
    x, y,
    range2: TOWER_RANGE * TOWER_RANGE,
    cooldown: TOWER_COOLDOWN,
    lastShot: -Infinity,
    damage: TOWER_DAMAGE,
    hp: TOWER_MAX_HP,
    maxHp: TOWER_MAX_HP,
    flashUntil: 0
  };
}

function inRangeSquaredTowerToEnemy(tower, enemy) {
  const dx = tower.x - enemy.x;
  const dy = tower.y - enemy.y;
  return (dx * dx + dy * dy) <= tower.range2;
}

// 選目標：優先打「更靠近終點/進度更大」的敵人
function pickTargetLeading(tower) {
  let best = null;
  let bestProg = -Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!inRangeSquaredTowerToEnemy(tower, e)) continue;
    if (e.progress > bestProg) {
      bestProg = e.progress;
      best = e;
    }
  }
  return best;
}

function towerTryShoot(tower, nowSec) {
  if (nowSec - tower.lastShot < tower.cooldown) return;

  const target = pickTargetLeading(tower);
  if (!target) return;

  tower.lastShot = nowSec;

  // 扣血
  target.hp -= tower.damage;
  if (target.hp <= 0) {
    target.hp = 0;
    killEnemy(target);
  }

  // 光束
  const a = gridToPixelCenter(tower.x, tower.y);
  const b = gridToPixelCenter(target.x, target.y);
  addBeam(a.x, a.y, b.x, b.y, "rgba(255,230,120,0.90)", 3, 0.95);
}

// 摧毀塔（被敵出生塔打爆）
function destroyTower(tower) {
  towers = towers.filter(t => t.id !== tower.id);
  gridBlocked[tower.y][tower.x] = false;
  clearTowerCell(tower.x, tower.y);
  updateHUD();
  flashMsg("你的塔被敵方出生塔摧毀了！");
}

/* ---- 敵方出生塔射擊：打離它最近的玩家塔 ---- */
function pickTowerNearestToEnemyBase() {
  if (towers.length === 0) return null;

  const bx = enemyBase.x, by = enemyBase.y;
  let best = null;
  let bestD2 = Infinity;

  for (const t of towers) {
    const dx = t.x - bx;
    const dy = t.y - by;
    const d2 = dx * dx + dy * dy;

    // 超出射程不打
    if (d2 > enemyBase.range2) continue;

    if (d2 < bestD2) {
      bestD2 = d2;
      best = t;
    }
  }
  return best;
}

function enemyBaseTryShoot(nowSec) {
  if (nowSec - enemyBase.lastShot < enemyBase.cooldown) return;

  const target = pickTowerNearestToEnemyBase();
  if (!target) return;

  enemyBase.lastShot = nowSec;

  // 扣玩家塔血量
  target.hp -= ENEMY_TOWER_DAMAGE;
  target.flashUntil = performance.now() + TOWER_HIT_FLASH_MS;

  if (target.hp <= 0) {
    destroyTower(target);
  }

  // 光束（紅色）
  const a = gridToPixelCenter(enemyBase.x, enemyBase.y);
  const b = gridToPixelCenter(target.x, target.y);
  addBeam(a.x, a.y, b.x, b.y, "rgba(255,90,90,0.85)", 4, 0.95);
}

/* =========================
   9) 敵人生成 / 移動 / 死亡
   ========================= */
function spawnEnemy() {
  if (!currentPath) return;

  // 血量：每波比例成長（越來越硬）
  const hp = getEnemyHp(wave);

  const palette = ["#ff5f5fff", "#6fe7ffff", "#9369ffff", "#ffcf6fff"];
  const color = palette[Math.floor(Math.random() * palette.length)];

  enemies.push({
    id: nextEnemyId++,
    x: START.x,
    y: START.y,
    hp,
    maxHp: hp,
    path: currentPath,
    pathIdx: 0,
    progress: 0, // 用於「離終點近」判斷
    alive: true,
    color
  });
}

function killEnemy(enemy) {
  enemy.alive = false;
  gold += GOLD_PER_KILL;
  score += SCORE_PER_KILL;
  updateHUD();
}

function leakEnemy(enemy) {
  enemy.alive = false;
  life -= LIFE_LOSS_ON_LEAK;
  if (life < 0) life = 0;
  updateHUD();
  if (life <= 0) gameOver();
}

// 根據 path 走格子（以 cell/sec 連續移動）
function updateEnemy(enemy, dt) {
  if (!enemy.alive) return;
  const path = enemy.path;
  if (!path || path.length < 2) return;

  const nextIdx = Math.min(enemy.pathIdx + 1, path.length - 1);
  const nextNode = path[nextIdx];

  const vx = nextNode.x - enemy.x;
  const vy = nextNode.y - enemy.y;
  const dist = Math.hypot(vx, vy);

  const step = ENEMY_SPEED * dt;

  if (dist <= step) {
    // 抵達下一格
    enemy.x = nextNode.x;
    enemy.y = nextNode.y;
    enemy.pathIdx = nextIdx;

    enemy.progress = enemy.pathIdx;

    // 到終點 → 漏怪
    if (enemy.x === END.x && enemy.y === END.y) {
      leakEnemy(enemy);
      return;
    }
  } else {
    // 連續移動（在格子之間）
    enemy.x += (vx / dist) * step;
    enemy.y += (vy / dist) * step;
    enemy.progress = enemy.pathIdx + (step / dist);
  }
}

/* =========================
   10) 放塔驗證：敵人不能穿塔
   - 放塔後要確保：
     A) START→END 還有路
     B) 每一隻活著的敵人「從它目前所在節點」到 END 也要有路
   ========================= */

// 檢查所有活著敵人的路徑是否仍存在
function validateAliveEnemiesPaths() {
  for (const e of enemies) {
    if (!e.alive) continue;

    // 取敵人當前「所在的格子節點」（用 pathIdx 的節點最穩）
    const node = (e.path && e.path.length)
      ? e.path[Math.min(e.pathIdx, e.path.length - 1)]
      : { x: Math.round(e.x), y: Math.round(e.y) };

    const pth = bfsPath(node, END);
    if (!pth) return false;
  }
  return true;
}

// 放塔後讓所有活著敵人重算路徑（繞塔走）
function rerouteAliveEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;

    const node = (e.path && e.path.length)
      ? e.path[Math.min(e.pathIdx, e.path.length - 1)]
      : { x: Math.round(e.x), y: Math.round(e.y) };

    const pth = bfsPath(node, END);
    if (!pth) continue;

    e.path = pth;
    e.pathIdx = 0;
    e.progress = 0;
    e.x = node.x;
    e.y = node.y;
  }
}

// 點格子放塔
function onCellClick(e) {
  // 未開始或暫停時不允許放塔
  if (!running || paused) return;

  const x = Number(e.currentTarget.dataset.x);
  const y = Number(e.currentTarget.dataset.y);

  // 起點/終點不能放塔
  if ((x === START.x && y === START.y) || (x === END.x && y === END.y)) {
    flashMsg("起點（敵方出生塔）/終點（基地）不能放塔。");
    return;
  }

  // 已有塔
  if (gridBlocked[y][x]) {
    flashMsg("這格已經有塔了。");
    return;
  }

  // 金幣不足
  if (gold < TOWER_COST) {
    flashMsg("金幣不足。");
    return;
  }

  // 先假設這格變成阻擋，試算路徑
  gridBlocked[y][x] = true;

  // A) START→END 必須有路
  const newPath = bfsPath(START, END);
  if (!newPath) {
    gridBlocked[y][x] = false;
    flashMsg("這樣會把路堵死，不能放塔。");
    return;
  }

  // B) 現有敵人也必須有路（避免敵人被卡住或穿塔）
  if (!validateAliveEnemiesPaths()) {
    gridBlocked[y][x] = false;
    flashMsg("這樣會讓現有敵人無路可走（或必須穿塔），不能放塔。");
    return;
  }

  // 放塔成功：更新主路徑 & 讓敵人重算路
  currentPath = newPath;
  rerouteAliveEnemies();

  // 扣錢、加入塔、畫塔
  gold -= TOWER_COST;
  towers.push(makeTower(x, y));
  paintTowerCell(x, y);

  updateHUD();
  if (SHOW_PATH_HINT) paintPathHint();
}

/* =========================
   11) 路徑提示（把路徑格子加上 class）
   ========================= */
function clearPathHint() {
  for (const c of cellEls) c.classList.remove("path");
}

function paintPathHint() {
  clearPathHint();
  if (!currentPath) return;

  for (const p of currentPath) {
    if ((p.x === START.x && p.y === START.y) || (p.x === END.x && p.y === END.y)) continue;
    cellEls[idx(p.x, p.y)].classList.add("path");
  }
}

/* =========================
   12) 波次系統（小→中→大 循環，但難度隨 wave 增加）
   ========================= */
function startNextWave() {
  waveActive = true;

  const cfg = getWaveConfig(wave, wavePatternIndex);
  waveToSpawn = cfg.count;
  waveSpawned = 0;
  spawnAcc = 0;

  flashMsg(`第 ${wave} 波（${cfg.name}）開始！${waveToSpawn} 隻｜間隔 ${cfg.interval.toFixed(2)}s｜敵HP ${getEnemyHp(wave)}`);
}

/* =========================
   13) 主迴圈 (Game Loop)
   ========================= */
function step(ts) {
  if (!running) return;

  // 暫停時不更新遊戲邏輯
  if (paused) {
    lastTime = ts;
    requestAnimationFrame(step);
    return;
  }

  // dt：本幀經過的秒數（避免切到背景回來爆炸，用上限 0.05）
  const dt = Math.min(0.05, (ts - lastTime) / 1000);
  lastTime = ts;

  /* ---------- 波次制出怪（越來越多、越來越快） ---------- */
  if (!waveActive) {
    // 休息倒數：倒數到 0 才開下一波
    betweenWaveTimer -= dt;
    if (betweenWaveTimer <= 0) {
      startNextWave();
    }
  } else {
    // 正在出怪：依照當前波型 + 波數 wave 動態 interval
    const cfg = getWaveConfig(wave, wavePatternIndex);
    const interval = cfg.interval;

    spawnAcc += dt;
    while (spawnAcc >= interval && waveSpawned < waveToSpawn) {
      spawnAcc -= interval;
      spawnEnemy();
      waveSpawned++;
    }

    // 本波怪都出完，且場上怪清空 → 進入下一波休息
    const alive = enemies.filter(e => e.alive).length;
    if (waveSpawned >= waveToSpawn && alive === 0) {
      waveActive = false;

      // 波型循環（小→中→大→小…）
      wavePatternIndex = (wavePatternIndex + 1) % WAVE_PATTERN.length;

      wave++;
      betweenWaveTimer = WAVE_REST_TIME;

      const nextName = WAVE_PATTERN[wavePatternIndex].name;
      flashMsg(`第 ${wave - 1} 波結束！${WAVE_REST_TIME} 秒後進入 ${nextName}（難度↑）`);
      updateHUD();
    }
  }

  /* ---------- 更新敵人移動 ---------- */
  for (const e of enemies) updateEnemy(e, dt);

  /* ---------- 玩家塔射擊 ---------- */
  const nowSec = ts / 1000;
  for (const t of towers) towerTryShoot(t, nowSec);

  /* ---------- 敵方出生塔射擊（打你的塔） ---------- */
  enemyBaseTryShoot(nowSec);

  // 適度清理死掉的 enemy（避免陣列無限大）
  enemies = enemies.filter(e => e.alive || Math.random() < 0.98);

  /* ---------- 畫面渲染 ---------- */
  renderAllCanvas();

  // HUD 更新
  updateHUD();

  requestAnimationFrame(step);
}

/* =========================
   14) 控制：開始 / 暫停 / 重開
   ========================= */
function startGame() {
  // 如果說明視窗開著，直接關掉就開始
  if (overlay && overlay.style.display === "flex") closeHowModal();

  if (running) return;

  running = true;
  paused = false;

  // 初始路徑
  currentPath = bfsPath(START, END);
  if (!currentPath) {
    flashMsg("找不到路徑（不應該發生，請檢查地圖）。");
    running = false;
    return;
  }

  if (SHOW_PATH_HINT) paintPathHint();

  resizeCanvas();
  updateHUD();
  msgEl && (msgEl.textContent = DEFAULT_HINT);

  // 波次初始化：開局先等 1 秒再出第一波
  wave = 1;
  wavePatternIndex = 0; // 從小波開始
  waveActive = false;
  betweenWaveTimer = 1.0;
  waveToSpawn = 0;
  waveSpawned = 0;
  spawnAcc = 0;

  lastTime = performance.now();
  requestAnimationFrame(step);
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (pauseBtn) pauseBtn.textContent = paused ? "繼續" : "暫停";
  flashMsg(paused ? "已暫停。" : "繼續遊戲！");
}

function resetGame() {
  running = false;
  paused = false;

  gold = 120;
  life = 20;
  score = 0;

  wave = 1;
  wavePatternIndex = 0;
  waveActive = false;
  betweenWaveTimer = 1.0;
  waveToSpawn = 0;
  waveSpawned = 0;
  spawnAcc = 0;

  towers = [];
  enemies = [];
  beams = [];
  nextTowerId = 1;
  nextEnemyId = 1;

  // 清空阻擋
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      gridBlocked[y][x] = false;

  // 清空格子狀態
  for (const c of cellEls) {
    c.classList.remove("tower", "towerDestroyed", "path");
    c.querySelectorAll(".towerArt").forEach(n => n.remove());
  }

  // 重新畫起點/終點裝飾
  paintEnemyBaseCell(START.x, START.y);
  paintPlayerBaseCell(END.x, END.y);

  // 重算路徑
  currentPath = bfsPath(START, END);
  if (SHOW_PATH_HINT) paintPathHint();

  if (pauseBtn) pauseBtn.textContent = "暫停";
  updateHUD();
  msgEl && (msgEl.textContent = DEFAULT_HINT);

  // 立即開始
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(step);
}

function gameOver() {
  running = false;
  paused = false;
  flashMsg("遊戲結束：生命歸零。按「重開」再試一次！");
}

/* =========================
   15) 綁定事件 / 初始化
   ========================= */
howBtn?.addEventListener("click", openHow);
closeHow?.addEventListener("click", closeHowModal);
startHow?.addEventListener("click", () => { closeHowModal(); startGame(); });

startBtn?.addEventListener("click", startGame);
pauseBtn?.addEventListener("click", togglePause);
resetBtn?.addEventListener("click", resetGame);

window.addEventListener("resize", resizeCanvas);

// 初始化啟動
function boot() {
  initGrid();
  resizeCanvas();

  // 初始路徑（尚未開始也可看到路徑）
  currentPath = bfsPath(START, END);
  if (SHOW_PATH_HINT) paintPathHint();

  msgEl && (msgEl.textContent = DEFAULT_HINT);
  updateHUD();
}
boot();