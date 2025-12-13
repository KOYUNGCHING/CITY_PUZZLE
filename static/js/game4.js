// ===============================
// Mini Tower Defense（15×10｜BFS｜Aliens｜Score-based spawn）
// - 擊殺 +20 分
// - 出怪頻率：分數越高越快（有上下限）
// - BFS 尋路：放塔會阻擋；堵死路禁止放塔
// - Canvas 畫外星人（仿你給的 drawAlien）
// ===============================

/* ---------- 0) Config ---------- */
const COLS = 15;
const ROWS = 10;

const START = { x: 0, y: Math.floor(ROWS / 2) };
const END   = { x: COLS - 1, y: Math.floor(ROWS / 2) };

const TOWER_COST = 25;
const TOWER_RANGE_CELLS = 3;
const TOWER_COOLDOWN = 0.55; // sec
const TOWER_DAMAGE = 18;

const ENEMY_BASE_HP = 80;
const ENEMY_SPEED = 2.6;        // cells/sec
const GOLD_PER_KILL = 8;
const LIFE_LOSS_ON_LEAK = 1;

const SCORE_PER_KILL = 20;

// 出怪頻率控制（關鍵）
// interval(score) = clamp( base - k * sqrt(score), min, base )
const SPAWN_BASE = 2.6;  // 一開始很慢：每 2.6 秒一隻
const SPAWN_MIN  = 0.55; // 最高只快到 0.55 秒一隻
const SPAWN_K    = 0.18; // 分數影響強度（可調）

const SHOW_PATH_HINT = true;

/* ---------- 1) State ---------- */
let running = false;
let paused = false;

let gold = 120;
let life = 20;
let wave = 1;
let score = 0;

let towers = [];   // {x,y, range2, cooldown, lastShot, damage}
let enemies = [];  // {id,x,y,hp,maxHp,path,pathIdx,progress,alive,color}
let nextEnemyId = 1;

let gridBlocked = [];   // boolean[ROWS][COLS]
let currentPath = null; // [{x,y}...]

let lastTime = 0;
let spawnAcc = 0;

let cellEls = [];

/* ---------- 2) DOM ---------- */
const gridEl = document.getElementById("grid");
const unitsEl = document.getElementById("units");
const canvas = document.getElementById("uCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const goldEl  = document.getElementById("gold");
const lifeEl  = document.getElementById("life");
const waveEl  = document.getElementById("wave");
const aliveEl = document.getElementById("alive");
const msgEl   = document.getElementById("msg");

const howBtn  = document.getElementById("howBtn");
const startBtn= document.getElementById("startBtn");
const pauseBtn= document.getElementById("pauseBtn");
const resetBtn= document.getElementById("resetBtn");

const overlay = document.getElementById("overlay");
const closeHow = document.getElementById("closeHow");
const startHow = document.getElementById("startHow");

/* ---------- 3) UI Helpers ---------- */
function updateHUD() {
  scoreEl.textContent = String(score);
  goldEl.textContent = String(gold);
  lifeEl.textContent = String(life);
  waveEl.textContent = String(wave);
  aliveEl.textContent = String(enemies.filter(e => e.alive).length);
}

let msgTimer = null;
function flashMsg(text) {
  msgEl.textContent = text;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    msgEl.textContent = "提示：點空白格放塔；若堵死路徑會被拒絕。分數越高，出怪越快。";
  }, 1800);
}

function openHow() {
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
}
function closeHowModal() {
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
}

/* ---------- 4) Geometry ---------- */
function idx(x, y) { return y * COLS + x; }
function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

function getCellMetrics() {
  const styles = getComputedStyle(document.documentElement);
  const cell = parseFloat(styles.getPropertyValue("--cell")) || 46;
  const gap  = parseFloat(styles.getPropertyValue("--gap"))  || 6;
  return { cell, gap };
}

function gridToPixelCenter(x, y) {
  const { cell, gap } = getCellMetrics();
  return {
    x: x * (cell + gap) + cell / 2,
    y: y * (cell + gap) + cell / 2
  };
}

function resizeCanvasToUnits() {
  const rect = unitsEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", () => {
  resizeCanvasToUnits();
  renderAllCanvas();
});

/* ---------- 5) BFS Pathfinding ---------- */
function bfsPath(start, goal) {
  const q = [];
  const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  q.push(start);
  visited[start.y][start.x] = true;

  const dirs = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  while (q.length) {
    const cur = q.shift();
    if (cur.x === goal.x && cur.y === goal.y) break;

    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (!inBounds(nx, ny)) continue;
      if (visited[ny][nx]) continue;

      // blocked 不能走（但起點/終點可走）
      if (!(nx === goal.x && ny === goal.y) && !(nx === start.x && ny === start.y)) {
        if (gridBlocked[ny][nx]) continue;
      }

      visited[ny][nx] = true;
      prev[ny][nx] = cur;
      q.push({ x: nx, y: ny });
    }
  }

  if (!visited[goal.y][goal.x]) return null;

  const path = [];
  let cur = goal;
  while (cur) {
    path.push(cur);
    cur = prev[cur.y][cur.x];
  }
  path.reverse();
  return path;
}

function renderPath(path) {
  for (const cell of cellEls) cell.classList.remove("path");
  if (!SHOW_PATH_HINT) return;
  if (!path) return;

  for (const p of path) {
    if ((p.x === START.x && p.y === START.y) || (p.x === END.x && p.y === END.y)) continue;
    cellEls[idx(p.x, p.y)].classList.add("path");
  }
}

/* ---------- 6) Drawing Aliens (your style) ---------- */
function drawAlien(x, y, r, color = "#9369ffff") {
  // 圓臉
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#000e44ff";
  ctx.lineWidth = 0;
  ctx.stroke();

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

  // 觸角
  const antennaY = y - r * 1.1;
  const ballR = r * 0.18;

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;

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

function drawHPBar(px, py, r, hp, maxHp) {
  const { cell } = getCellMetrics();
  const w = cell * 0.72;
  const h = 6;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px - w / 2, py - r - 14, w, h);

  ctx.fillStyle = "rgba(120,255,160,0.65)";
  ctx.fillRect(px - w / 2, py - r - 14, w * ratio, h);
  ctx.globalAlpha = 1.0;
}

/* 光束特效（簡單） */
const beams = []; // {x1,y1,x2,y2,t0}
function addBeam(x1, y1, x2, y2) {
  beams.push({ x1, y1, x2, y2, t0: performance.now() });
}
function renderBeams() {
  const now = performance.now();
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i];
    const age = (now - b.t0) / 1000;
    if (age > 0.12) { beams.splice(i, 1); continue; }
    const alpha = 1 - age / 0.12;

    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,230,120,0.85)";
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function renderAllCanvas() {
  const rect = unitsEl.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const { cell } = getCellMetrics();
  const r = cell * 0.31;

  for (const e of enemies) {
    if (!e.alive) continue;
    const p = gridToPixelCenter(e.x, e.y);
    drawAlien(p.x, p.y, r, e.color);
    drawHPBar(p.x, p.y, r, e.hp, e.maxHp);
  }
  renderBeams();
}

/* ---------- 7) Grid + Towers ---------- */
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

      if (x === START.x && y === START.y) cell.classList.add("start");
      if (x === END.x && y === END.y) cell.classList.add("end");

      cell.addEventListener("click", onCellClick);
      gridEl.appendChild(cell);
      cellEls.push(cell);
    }
  }
}

function paintTowerCell(x, y) {
  const cell = cellEls[idx(x, y)];
  cell.classList.add("tower");

  // 清掉舊的
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

function makeTower(x, y) {
  return {
    x, y,
    range2: TOWER_RANGE_CELLS * TOWER_RANGE_CELLS, // 平方射程
    cooldown: TOWER_COOLDOWN,
    lastShot: -Infinity,
    damage: TOWER_DAMAGE
  };
}

/* 距離函數：平方距離判射程 */
function inRangeSquared(tower, enemy) {
  const dx = tower.x - enemy.x;
  const dy = tower.y - enemy.y;
  return (dx * dx + dy * dy) <= tower.range2;
}

/* 目標選擇：最前（progress 最大） */
function pickTargetLeading(tower) {
  let best = null;
  let bestProg = -Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!inRangeSquared(tower, e)) continue;
    if (e.progress > bestProg) {
      bestProg = e.progress;
      best = e;
    }
  }
  return best;
}

/* cooldown 排程射擊 */
function towerTryShoot(tower, nowSec) {
  if (nowSec - tower.lastShot < tower.cooldown) return;

  const target = pickTargetLeading(tower);
  if (!target) return;

  tower.lastShot = nowSec;

  target.hp -= tower.damage;
  if (target.hp <= 0) {
    target.hp = 0;
    killEnemy(target);
  }

  const a = gridToPixelCenter(tower.x, tower.y);
  const b = gridToPixelCenter(target.x, target.y);
  addBeam(a.x, a.y, b.x, b.y);
}

/* ---------- 8) Enemies ---------- */
function spawnEnemy() {
  if (!currentPath) return;

  // wave 讓敵人更硬（可留可不留）
  const hp = ENEMY_BASE_HP + (wave - 1) * 10;

  const palette = ["#9369ffff", "#6fe7ffff", "#7bffb7ff", "#ffcf6fff"];
  const color = palette[Math.floor(Math.random() * palette.length)];

  enemies.push({
    id: nextEnemyId++,
    x: START.x,
    y: START.y,
    hp,
    maxHp: hp,
    path: currentPath,
    pathIdx: 0,
    progress: 0,
    alive: true,
    color
  });
}

function killEnemy(enemy) {
  enemy.alive = false;

  // 金幣 + 積分
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
    enemy.x = nextNode.x;
    enemy.y = nextNode.y;
    enemy.pathIdx = nextIdx;
    enemy.progress = enemy.pathIdx;

    if (enemy.x === END.x && enemy.y === END.y) {
      leakEnemy(enemy);
      return;
    }
  } else {
    enemy.x += (vx / dist) * step;
    enemy.y += (vy / dist) * step;
    enemy.progress = enemy.pathIdx + (step / dist);
  }
}

/* ---------- 9) Placing Towers with BFS validation ---------- */
function onCellClick(e) {
  if (!running || paused) return;

  const x = Number(e.currentTarget.dataset.x);
  const y = Number(e.currentTarget.dataset.y);

  if ((x === START.x && y === START.y) || (x === END.x && y === END.y)) {
    flashMsg("起點/終點不能放塔。");
    return;
  }

  if (gridBlocked[y][x]) {
    flashMsg("這格已經有塔了。");
    return;
  }

  if (gold < TOWER_COST) {
    flashMsg("金幣不足。");
    return;
  }

  // 先試放塔再 BFS
  gridBlocked[y][x] = true;
  const newPath = bfsPath(START, END);

  if (!newPath) {
    gridBlocked[y][x] = false;
    flashMsg("這樣會堵死路徑，放塔被拒絕。");
    return;
  }

  // 成功放塔
  gold -= TOWER_COST;
  towers.push(makeTower(x, y));
  paintTowerCell(x, y);

  currentPath = newPath;
  renderPath(currentPath);

  // 讓存活敵人從當前格重新 BFS（更真實）
  for (const en of enemies) {
    if (!en.alive) continue;
    const cell = { x: Math.round(en.x), y: Math.round(en.y) };
    const p = bfsPath(cell, END);
    if (p) {
      en.path = p;
      en.pathIdx = 0;
      en.progress = 0;
    }
  }

  updateHUD();
}

/* ---------- 10) Spawn interval as function of score ---------- */
function spawnIntervalFromScore(s) {
  // base - k*sqrt(score)，分數越大越快，但遞減速度會逐漸趨緩（更平滑）
  const v = SPAWN_BASE - SPAWN_K * Math.sqrt(Math.max(0, s));
  return Math.max(SPAWN_MIN, Math.min(SPAWN_BASE, v));
}

/* ---------- 11) Game flow ---------- */
function setupGame() {
  towers = [];
  enemies = [];
  nextEnemyId = 1;

  gold = 120;
  life = 20;
  wave = 1;
  score = 0;

  running = false;
  paused = false;
  spawnAcc = 0;

  initGrid();

  currentPath = bfsPath(START, END);
  renderPath(currentPath);

  resizeCanvasToUnits();
  updateHUD();
  renderAllCanvas();

  flashMsg("已準備好。按「開始」或看「遊戲說明」。");
}

function startGame() {
  if (running) return;
  if (!currentPath) {
    flashMsg("目前沒有可行路徑（不該發生）。");
    return;
  }
  running = true;
  paused = false;

  startBtn.disabled = true;
  pauseBtn.textContent = "暫停";

  lastTime = performance.now() / 1000;
  spawnAcc = 0;

  flashMsg("開始！點格子放塔，擊殺 +20 分，分數越高出怪越快。");
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "繼續" : "暫停";
  if (!paused) {
    lastTime = performance.now() / 1000;
    requestAnimationFrame(loop);
  }
}

function restart() {
  startBtn.disabled = false;
  setupGame();
}

function gameOver() {
  running = false;
  paused = false;
  startBtn.disabled = false;
  pauseBtn.textContent = "暫停";
  flashMsg(`💀 Game Over！你的分數：${score}。按「重開」再試一次。`);
}

/* 主迴圈 */
function loop() {
  if (!running || paused) return;

  const nowSec = performance.now() / 1000;
  const dt = Math.min(0.05, nowSec - lastTime);
  lastTime = nowSec;

  // 波次：每 20 秒 +1（只是展示）
  const targetWave = 1 + Math.floor(nowSec / 20);
  if (targetWave > wave) {
    wave = targetWave;
    updateHUD();
  }

  // 出怪：分數越高 interval 越短
  spawnAcc += dt;
  const interval = spawnIntervalFromScore(score);

  while (spawnAcc >= interval) {
    spawnAcc -= interval;
    spawnEnemy();
  }

  // 更新敵人
  for (const e of enemies) updateEnemy(e, dt);

  // 更新塔（cooldown）
  for (const t of towers) towerTryShoot(t, nowSec);

  updateHUD();
  renderAllCanvas();

  requestAnimationFrame(loop);
}

/* ---------- 12) Events ---------- */
howBtn.addEventListener("click", openHow);
closeHow.addEventListener("click", closeHowModal);
startHow.addEventListener("click", () => { closeHowModal(); startGame(); });

startBtn.addEventListener("click", () => {
  // 第一次按開始先開說明也更友善（你想直接開始可改成 startGame()）
  openHow();
});
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", restart);

/* ---------- Boot ---------- */
setupGame();