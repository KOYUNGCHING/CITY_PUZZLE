// =======================================================
// game3.js - Tech Alien Claw
// 特色：三色外星人 / 第5關亂跑 / 科技星空+HUD / EXIT+PAUSE+RESTART右側
// =======================================================

/* ---------------------------
 * 0) DOM / Canvas
 * --------------------------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreSpan  = document.getElementById("score");
const levelSpan  = document.getElementById("level");
const targetSpan = document.getElementById("target");
const timerSpan  = document.getElementById("timer");

const restartBtn = document.getElementById("restartBtn");
const exitBtn = document.getElementById("exitBtn");
const pauseBtn = document.getElementById("pauseBtn");

/* ---------------------------
 * 1) Resize
 * --------------------------- */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 之後用 CSS px 畫
  // 重建星空快取（尺寸變了）
  starLayer = starLayer2 = nebulaLayer = null;
}
window.addEventListener("resize", resizeCanvas);

/* ---------------------------
 * 2) 遊戲狀態
 * --------------------------- */
const STATE = { SWING: 0, EXTEND: 1, PULL: 2, OVER: 3 };
let state = STATE.SWING;

let score = 0;
let levelIndex = 0;     // 0-based
let currentTarget = 60;
let timeLeft = 60;
let timerId = null;

let paused = false;

const items = [];
let caughtItem = null;

/* ---------------------------
 * 3) 工具
 * --------------------------- */
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

/* ---------------------------
 * 4) 外星人三種：紅大 / 藍中 / 紫小
 *    value：越小越高
 *    pullSpeed：越大越慢（重）
 * --------------------------- */
const ALIENS = {
  small:  { color: "#ae8effff", r: 22, value: 50, pull: 5.2 }, // 紫小
  medium: { color: "#67b6ffff", r: 32, value: 35, pull: 4.2 }, // 藍中
  large:  { color: "#ff6259ff", r: 42, value: 20, pull: 3.2 }  // 紅大
};

function levelConfig(L) {
  return {
    small:  clamp(2 + Math.floor((L - 1) * 0.25), 2, 5),
    medium: clamp(2 + Math.floor((L - 1) * 0.35), 3, 7),
    large:  clamp(1 + Math.floor((L - 1) * 0.25), 2, 6),
    meteors: clamp(1 + Math.floor((L - 1) * 0.2), 3, 6),
    swingRange: 0.85 + (L - 1) * 0.05,
    swingSpeed: 0.013 + (L - 1) * 0.0012,
    target: 60 + (L - 1) * 90,
    time: 30
  };
}

/* ---------------------------
 * 5) 生成地面物件
 * --------------------------- */
function groundBounds() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  return {
    xMin: 70,
    xMax: w - 70,
    yMin: h * 0.48,
    yMax: h - 70
  };
}

function spawnMeteor() {
  const g = groundBounds();
  items.push({
    type: "meteor",
    x: rand(g.xMin, g.xMax),
    y: rand(g.yMin, g.yMax),
    radius: 22,
    value: -20,
    pullSpeed: 2.4,
    vx: 0, vy: 0,
    wobbleSeed: Math.random() * 1000
  });
}

function addAlien(sizeKey) {
  const A = ALIENS[sizeKey];
  const g = groundBounds();
  const L = levelIndex + 1;

  // 第5關開始「亂跑亂動」
  const chaotic = (L >= 5);

  const baseV = chaotic ? rand(0.9, 2.1) : 0;         // 基本速度
  const theta = rand(0, Math.PI * 2);

  items.push({
    type: "alien",
    size: sizeKey,
    x: rand(g.xMin, g.xMax),
    y: rand(g.yMin, g.yMax),
    radius: A.r,
    color: A.color,
    value: A.value,
    pullSpeed: A.pull,
    chaotic,
    vx: chaotic ? Math.cos(theta) * baseV : 0,
    vy: chaotic ? Math.sin(theta) * baseV : 0,
    wobbleSeed: Math.random() * 1000
  });
}

function populateLevel() {
  items.length = 0;
  const cfg = levelConfig(levelIndex + 1);

  for (let i = 0; i < cfg.small; i++) addAlien("small");
  for (let i = 0; i < cfg.medium; i++) addAlien("medium");
  for (let i = 0; i < cfg.large; i++) addAlien("large");
  for (let i = 0; i < cfg.meteors; i++) spawnMeteor();

  currentTarget = cfg.target;
  timeLeft = cfg.time;

  levelSpan.textContent  = "關卡：" + (levelIndex + 1);
  targetSpan.textContent = "目標：" + currentTarget;
  timerSpan.textContent  = "時間：" + timeLeft;
  scoreSpan.textContent  = "Score: " + score;
}

/* ---------------------------
 * 6) 星空背景（程序生成 + 快取）
 * --------------------------- */
let starLayer = null;
let starLayer2 = null;
let nebulaLayer = null;

function buildStarfield(w, h) {
  starLayer = document.createElement("canvas");
  starLayer.width = w;
  starLayer.height = h;
  const sctx = starLayer.getContext("2d");

  const g = sctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#05061c");
  g.addColorStop(1, "#01010a");
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, w, h);

  const n1 = Math.floor((w * h) / 3600);
  for (let i = 0; i < n1; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = (Math.random() ** 2) * 1.8 + 0.2;
    const a = 0.25 + Math.random() * 0.75;

    sctx.beginPath();
    sctx.fillStyle = `rgba(255,255,255,${a})`;
    sctx.arc(x, y, r, 0, Math.PI * 2);
    sctx.fill();

    if (Math.random() < 0.08) {
      const glow = r * (3 + Math.random() * 4);
      const rg = sctx.createRadialGradient(x, y, 0, x, y, glow);
      rg.addColorStop(0, `rgba(100,200,255,${a * 0.25})`);
      rg.addColorStop(1, "rgba(100,200,255,0)");
      sctx.fillStyle = rg;
      sctx.beginPath();
      sctx.arc(x, y, glow, 0, Math.PI * 2);
      sctx.fill();
    }
  }

  starLayer2 = document.createElement("canvas");
  starLayer2.width = w;
  starLayer2.height = h;
  const s2 = starLayer2.getContext("2d");
  const n2 = Math.floor((w * h) / 1900);

  for (let i = 0; i < n2; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = (Math.random() ** 2) * 1.2 + 0.1;
    const a = 0.08 + Math.random() * 0.25;
    s2.beginPath();
    s2.fillStyle = `rgba(200,230,255,${a})`;
    s2.arc(x, y, r, 0, Math.PI * 2);
    s2.fill();
  }

  nebulaLayer = document.createElement("canvas");
  nebulaLayer.width = w;
  nebulaLayer.height = h;
  const nctx = nebulaLayer.getContext("2d");

  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const rad = Math.min(w, h) * (0.18 + Math.random() * 0.22);

    const ng = nctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const a = 0.05 + Math.random() * 0.06;
    ng.addColorStop(0, `rgba(90,180,255,${a})`);
    ng.addColorStop(0.55, `rgba(180,110,255,${a * 0.75})`);
    ng.addColorStop(1, "rgba(0,0,0,0)");

    nctx.fillStyle = ng;
    nctx.beginPath();
    nctx.arc(cx, cy, rad, 0, Math.PI * 2);
    nctx.fill();
  }
}

function drawTechHUD(t) {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;

  // 掃描線
  const scanY = (t * 0.04) % h;
  ctx.strokeStyle = "rgba(120,255,220,0.35)";
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(w, scanY);
  ctx.stroke();

  // 網格
  const grid = 40;
  ctx.strokeStyle = "rgba(90,200,255,0.18)";
  ctx.beginPath();
  for (let x = 0; x <= w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  ctx.restore();
}

function drawStarfield(t = 0) {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  // 注意：offscreen 用實際像素（dpr後的 canvas.width/height），但繪圖用 CSS px
  if (!starLayer || starLayer.width !== canvas.width || starLayer.height !== canvas.height) {
    buildStarfield(canvas.width, canvas.height);
  }

  // 以 1:1 縮放到 CSS px（ctx 已 setTransform(dpr,... )，所以這裡用 css 尺寸畫）
  ctx.drawImage(starLayer, 0, 0, w, h);

  ctx.globalAlpha = 0.95;
  ctx.drawImage(nebulaLayer, 0, 0, w, h);
  ctx.globalAlpha = 1;

  const dx = Math.sin(t * 0.00015) * 12;
  const dy = Math.cos(t * 0.00012) * 10;

  ctx.globalAlpha = 0.85;
  ctx.drawImage(starLayer2, dx, dy, w, h);
  ctx.drawImage(starLayer2, dx - w, dy, w, h);
  ctx.drawImage(starLayer2, dx, dy - h, w, h);
  ctx.drawImage(starLayer2, dx - w, dy - h, w, h);
  ctx.globalAlpha = 1;

  drawTechHUD(t);
}

/* ---------------------------
 * 7) 外星人繪圖（你指定版本：雙觸角）
 * --------------------------- */
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

    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.arc(cx - eyeR * 0.15, cy - eyeR * 0.15, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEye(x - eyeOffset, y - r * 0.1);
  drawEye(x + eyeOffset, y - r * 0.1);

  // 觸角（雙）
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

function drawMeteor(x, y, r) {
  ctx.save();
  ctx.translate(x, y);

  const spikes = 7;
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2;
    const rr = r * (0.65 + Math.random() * 0.35);
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  ctx.fillStyle = "rgba(80,90,120,0.9)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(140,220,255,0.35)";
  ctx.stroke();

  ctx.restore();
}

/* ---------------------------
 * 8) 機械爪（更好看科技感）
 * --------------------------- */
const claw = {
  originX: () => canvas.getBoundingClientRect().width / 2,
  originY: () => 75,
  minLen: 70,
  maxLen: 600,
  len: 70,
  ang: 0,
  dir: 1,
  swingRange: 0.9,
  swingSpeed: 0.013,
  extendSpeed: 7.7,
  pullBase: 6.2
};

function tipPos() {
  const ox = claw.originX();
  const oy = claw.originY();
  const x = ox + Math.sin(claw.ang) * claw.len;
  const y = oy + Math.cos(claw.ang) * claw.len;
  return { x, y };
}

function drawRopeAndClaw(t) {
  const ox = claw.originX();
  const oy = claw.originY();
  const tip = tipPos();

  // 金屬漸層纜線
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 6;

  const cableGrad = ctx.createLinearGradient(ox, oy, tip.x, tip.y);
  cableGrad.addColorStop(0, "rgba(180,200,220,0.95)");
  cableGrad.addColorStop(0.5, "rgba(90,110,140,0.95)");
  cableGrad.addColorStop(1, "rgba(200,220,255,0.95)");

  ctx.strokeStyle = cableGrad;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  // 霓虹節點（像電流）
  const segments = Math.max(10, Math.floor(claw.len / 26));
  for (let i = 1; i < segments; i++) {
    const px = ox + ((tip.x - ox) * i) / segments;
    const py = oy + ((tip.y - oy) * i) / segments;
    const pulse = 0.25 + 0.22 * Math.sin(t * 0.004 + i);
    ctx.beginPath();
    ctx.fillStyle = `rgba(90,255,220,${pulse})`;
    ctx.arc(px, py, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 爪子本體：徑向金屬艙 + 霓虹外圈
  const headR = 12;
  const rg = ctx.createRadialGradient(tip.x - 4, tip.y - 4, 2, tip.x, tip.y, headR + 6);
  rg.addColorStop(0, "rgba(80,95,120,0.98)");
  rg.addColorStop(0.6, "rgba(30,40,58,0.98)");
  rg.addColorStop(1, "rgba(12,16,26,0.98)");

  ctx.beginPath();
  ctx.fillStyle = rg;
  ctx.arc(tip.x, tip.y, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = paused ? "rgba(255,220,140,0.55)" : "rgba(120,255,240,0.55)";
  ctx.stroke();

  // 兩側爪臂（更像鉤子）
  const vx = tip.x - ox;
  const vy = tip.y - oy;
  const vlen = Math.hypot(vx, vy) || 1;
  const ux = vx / vlen;
  const uy = vy / vlen;
  const nx = -uy, ny = ux;

  // 爪子開合角度：沒抓時張開，抓到時微收
  const prongOpen = caughtItem ? 8 : 16;
  const prongLen = 20;
  const hookLen = 9;

  function drawProng(sign) {
    const bx = tip.x + nx * prongOpen * sign;
    const by = tip.y + ny * prongOpen * sign;

    const ex = bx + ux * prongLen;
    const ey = by + uy * prongLen;

    // 主臂
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(170,190,220,0.98)";
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // 霓虹描邊
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = paused ? "rgba(255,220,140,0.45)" : "rgba(90,255,220,0.45)";
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // 鉤子尖端（向內勾）
    const hx = ex + (nx * -sign) * hookLen;
    const hy = ey + (ny * -sign) * hookLen;

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(170,190,220,0.98)";
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = paused ? "rgba(255,220,140,0.45)" : "rgba(90,255,220,0.45)";
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }

  drawProng(-1);
  drawProng(+1);

  // 柔光圈
  const glowR = 40;
  const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, glowR);
  glow.addColorStop(0, paused ? "rgba(255,220,140,0.14)" : "rgba(90,255,220,0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ---------------------------
 * 9) 更新：第5關亂跑亂動（含抖動）
 * --------------------------- */
function updateItems(t) {
  const g = groundBounds();

  for (const it of items) {
    if (!it.chaotic) continue;

    // 抖動（讓路徑不像直線）
    const wob = 0.8 + 0.8 * Math.sin((t * 0.002) + it.wobbleSeed);
    const wob2 = 0.8 + 0.8 * Math.cos((t * 0.0016) + it.wobbleSeed);

    it.x += it.vx * wob;
    it.y += it.vy * wob2;

    // 隨機微改方向（看起來更亂跑）
    if (Math.random() < 0.02) {
      const ang = rand(-0.7, 0.7);
      const cx = Math.cos(ang), sx = Math.sin(ang);
      const nvx = it.vx * cx - it.vy * sx;
      const nvy = it.vx * sx + it.vy * cx;
      it.vx = nvx;
      it.vy = nvy;
    }

    // 反彈（考慮半徑）
    const r = it.radius;
    if (it.x < g.xMin + r) { it.x = g.xMin + r; it.vx *= -1; }
    if (it.x > g.xMax - r) { it.x = g.xMax - r; it.vx *= -1; }
    if (it.y < g.yMin + r) { it.y = g.yMin + r; it.vy *= -1; }
    if (it.y > g.yMax - r) { it.y = g.yMax - r; it.vy *= -1; }
  }
}

/* ---------------------------
 * 10) 碰撞：嘗試抓取
 * --------------------------- */
function tryCatch() {
  if (caughtItem) return;
  const tip = tipPos();

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const d = Math.hypot(tip.x - it.x, tip.y - it.y);
    if (d <= it.radius + 14) {
      caughtItem = it;
      items.splice(i, 1);
      return;
    }
  }
}

/* ---------------------------
 * 11) 爪子狀態機
 * --------------------------- */
function updateClaw() {
  const cfg = levelConfig(levelIndex + 1);
  claw.swingRange = cfg.swingRange;
  // 分數影響擺動（對數成長，不會爆）
  const scoreBoost = Math.log10(score + 1) * 0.0025;

  // 整體靈敏度倍率（★關鍵）
  const sensitivity = 1.25;

  claw.swingSpeed = (cfg.swingSpeed + scoreBoost) * sensitivity;

  if (state === STATE.SWING) {
    claw.ang += claw.swingSpeed * claw.dir;
    if (claw.ang > claw.swingRange) { claw.ang = claw.swingRange; claw.dir = -1; }
    if (claw.ang < -claw.swingRange) { claw.ang = -claw.swingRange; claw.dir = 1; }
    claw.len = claw.minLen;
  }

  if (state === STATE.EXTEND) {
    claw.len += claw.extendSpeed;
    tryCatch();
    if (claw.len >= claw.maxLen) state = STATE.PULL;
    if (caughtItem) state = STATE.PULL;
  }

  if (state === STATE.PULL) {
    const pull = caughtItem
    ? caughtItem.pullSpeed * 1.15   // 抓到東西也更乾脆
    : claw.pullBase * 1.25;
    claw.len -= pull;

    if (claw.len <= claw.minLen) {
      claw.len = claw.minLen;

      if (caughtItem) {
        score += caughtItem.value;
        scoreSpan.textContent = "Score: " + score;
        caughtItem = null;
      }

      if (score >= currentTarget) {
        levelIndex++;
        populateLevel();
      }

      state = (timeLeft <= 0) ? STATE.OVER : STATE.SWING;
    }
  }
}

/* ---------------------------
 * 12) 繪製物件
 * --------------------------- */
function drawItems() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  // 地面分界線（淡淡）
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(120,255,220,0.22)";
  ctx.lineWidth = 2;
  const y = h * 0.48;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.restore();

  for (const it of items) {
    if (it.type === "alien") drawAlien(it.x, it.y, it.radius, it.color);
    else drawMeteor(it.x, it.y, it.radius);
  }

  // 被抓到的物件跟著爪子
  if (caughtItem) {
    const tip = tipPos();
    const yy = tip.y + caughtItem.radius * 0.6;
    if (caughtItem.type === "alien") drawAlien(tip.x, yy, caughtItem.radius, caughtItem.color);
    else drawMeteor(tip.x, yy, caughtItem.radius);
  }
}

function drawOverlay() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  if (state === STATE.OVER) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 44px Arial";
    ctx.fillText("GAME OVER", w / 2, h / 2 - 24);

    ctx.font = "20px Arial";
    ctx.fillStyle = "rgba(200,230,255,0.9)";
    ctx.fillText("按 RESTART 重新開始", w / 2, h / 2 + 20);
    ctx.restore();
  }

  if (paused && state !== STATE.OVER) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(210,255,245,0.95)";
    ctx.font = "bold 40px Arial";
    ctx.fillText("PAUSED", w / 2, h / 2);
    ctx.restore();
  }
}

/* ---------------------------
 * 13) 暫停控制（含倒數停止）
 * --------------------------- */
function startTimer() {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    if (paused || state === STATE.OVER) return;
    timeLeft -= 1;
    if (timeLeft <= 0) {
      timeLeft = 0;
      state = STATE.OVER;
    }
    timerSpan.textContent = "時間：" + timeLeft;
  }, 1000);
}

function setPaused(p) {
  paused = p;
  pauseBtn.textContent = paused ? "RESUME" : "PAUSE";
  // timer 也跟著停/開（簡潔而穩）
  if (paused) {
    if (timerId) { clearInterval(timerId); timerId = null; }
  } else {
    startTimer();
  }
}

/* ---------------------------
 * 14) 主迴圈
 * --------------------------- */
function tick(t) {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  // 清畫面 + 背景
  ctx.clearRect(0, 0, w, h);
  drawStarfield(t);

  if (!paused && state !== STATE.OVER) {
    updateItems(t);
    updateClaw();
  }

  drawItems();
  drawRopeAndClaw(t);
  drawOverlay();

  requestAnimationFrame(tick);
}

/* ---------------------------
 * 15) 操作
 * --------------------------- */
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!paused && state === STATE.SWING) state = STATE.EXTEND;
  }
  if (e.key === "p" || e.key === "P") {
    if (state !== STATE.OVER) setPaused(!paused);
  }
  if (e.key === "r" || e.key === "R") {
    resetGame();
  }
});

/* ---------------------------
 * 16) 按鈕
 * --------------------------- */


pauseBtn.addEventListener("click", () => {
  if (state === STATE.OVER) return;
  setPaused(!paused);
});

restartBtn.addEventListener("click", () => resetGame());

/* ---------------------------
 * 17) Reset / Init
 * --------------------------- */
function resetGame() {
  paused = false;
  pauseBtn.textContent = "PAUSE";

  score = 0;
  levelIndex = 0;
  state = STATE.SWING;
  caughtItem = null;

  scoreSpan.textContent = "Score: 0";
  populateLevel();
  startTimer();
}

resizeCanvas();
resetGame();
requestAnimationFrame(tick);