// ==============================
// 取得畫布與 UI 元素
// ==============================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hpText = document.getElementById("hpText");
const scoreText = document.getElementById("scoreText");
const alienCountText = document.getElementById("alienCount");
const buffText = document.getElementById("buffText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// ==============================
// 輸入狀態（鍵盤/滑鼠）
// ==============================
const keys = {};
let mouseX = WIDTH / 2;
let mouseY = HEIGHT / 2;
let shooting = false;

// ==============================
// 遊戲狀態
// ==============================
let lastTime = 0;
let player;
let enemies = [];
let bullets = [];
let powerups = [];

let spawnTimer = 0;
let gameOver = false;
let paused = false;
let gameStarted = false;   // 必須按「開始遊戲」才會變 true
let score = 0;

// ★ 新增：防止重複上傳的旗標
let dataUploaded = false;

// ==============================
// 牆壁（矩形）
// ==============================
const walls = [
  { x: 350, y: 230, w: 200, h: 30 },
  { x: 150, y: 120, w: 120, h: 30 },
  { x: 600, y: 400, w: 180, h: 30 },
  { x: 120, y: 380, w: 140, h: 30 },
  { x: 600, y: 160, w: 150, h: 30 }
];

// ==============================
// 工具函式（數學/碰撞）
// ==============================
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dist = Math.hypot(cx - closestX, cy - closestY);
  return dist < cr;
}

function bulletHitsAnyWall(b) {
  for (let w of walls) {
    if (circleRectCollide(b.x, b.y, b.radius, w.x, w.y, w.w, w.h)) return true;
  }
  return false;
}

// ==============================
// 難度（每 1000 分升級）
// ==============================
function difficultyLevel() {
  return Math.floor(score / 500);
}

function getMaxEnemies() {
  const lvl = difficultyLevel();
  return 10 + lvl * 8;
}

function getSpawnInterval() {
  const lvl = difficultyLevel();
  return Math.max(0.35, 1.2 - lvl * 0.12);
}

// ==============================
// 可愛外星人畫風（你提供）
// ==============================
function drawAlien(x, y, r, color = "#9f7affff") {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

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
  const w = r * 2.2;
  const h = 6;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px - w / 2, py - r - 16, w, h);

  ctx.fillStyle = "rgba(120,255,160,0.65)";
  ctx.fillRect(px - w / 2, py - r - 16, w * ratio, h);

  ctx.globalAlpha = 1.0;
}

// ==============================
// 敵人類型（顏色→掉落/獎勵）
// ==============================
const ENEMY_TYPES = {
  RED:    { key: "red",    color: "#fe6d88ff", drop: "heal",   radius: 16, maxHp: 4, speed: 110, score: 10 },
  BLUE:   { key: "blue",   color: "#6bb8ffff", drop: "speed",  radius: 16, maxHp: 4, speed: 115, score: 10 },
  YELLOW: { key: "yellow", color: "#ffd77bff", drop: "shield", radius: 16, maxHp: 4, speed: 105, score: 10 },
  PURPLE_MINI: { key: "purple_mini", color: "#af80fcff", drop: null, radius: 11, maxHp: 10, speed: 150, score: 20 }
};

function purpleSpawnChance() {
  const lvl = difficultyLevel();
  return Math.min(0.04 + lvl * 0.005, 0.10); // 4% 起跳，最多 10%
}

function randomNormalType() {
  const r = Math.random();
  if (r < 0.34) return ENEMY_TYPES.RED;
  if (r < 0.67) return ENEMY_TYPES.BLUE;
  return ENEMY_TYPES.YELLOW;
}

// ==============================
// 玩家
// ==============================
class Player {
  constructor() {
    this.x = WIDTH / 2;
    this.y = HEIGHT / 2;
    this.radius = 16;

    this.baseSpeed = 220;

    this.hp = 100;
    this.maxHp = 100;

    this.speedBuffTimer = 0;
    this.shieldTimer = 0;

    this.fireCooldown = 0;
    this.fireRate = 0.18;
  }

  getSpeed() {
    return this.baseSpeed * (this.speedBuffTimer > 0 ? 1.6 : 1);
  }

  hasShield() {
    return this.shieldTimer > 0;
  }

  update(dt) {
    let dx = 0, dy = 0;
    if (keys["KeyW"]) dy -= 1;
    if (keys["KeyS"]) dy += 1;
    if (keys["KeyA"]) dx -= 1;
    if (keys["KeyD"]) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    const speed = this.getSpeed();
    const nextX = this.x + dx * speed * dt;
    const nextY = this.y + dy * speed * dt;

    const oldX = this.x;
    this.x = nextX;
    if (this.collidesWithWalls()) this.x = oldX;

    const oldY = this.y;
    this.y = nextY;
    if (this.collidesWithWalls()) this.y = oldY;

    this.x = Math.max(this.radius, Math.min(WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(HEIGHT - this.radius, this.y));

    if (this.speedBuffTimer > 0) this.speedBuffTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (shooting) this.tryShoot();
  }

  collidesWithWalls() {
    const r = this.radius;
    for (let w of walls) {
      const closestX = clamp(this.x, w.x, w.x + w.w);
      const closestY = clamp(this.y, w.y, w.y + w.h);
      const dist = Math.hypot(this.x - closestX, this.y - closestY);
      if (dist < r) return true;
    }
    return false;
  }

  tryShoot() {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = this.fireRate;

    const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
    const speed = 520;

    bullets.push(new Bullet(
      this.x + Math.cos(angle) * this.radius,
      this.y + Math.sin(angle) * this.radius,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    ));
  }

  draw() {
    const angle = Math.atan2(mouseY - this.y, mouseX - this.x);

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.arc(0, -18, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(-8, 26);
    ctx.moveTo(0, 12);
    ctx.lineTo(8, 26);
    ctx.stroke();

    ctx.save();
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(14, -2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(30, -2);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    if (this.hasShield()) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(80, 200, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ==============================
// 敵人
// ==============================
class Enemy {
  constructor(x, y, typeInfo) {
    this.x = x;
    this.y = y;

    this.type = typeInfo.key;
    this.color = typeInfo.color;
    this.drop = typeInfo.drop;

    this.radius = typeInfo.radius;
    this.speed = typeInfo.speed;

    this.maxHp = typeInfo.maxHp;
    this.hp = this.maxHp;

    this.baseScore = typeInfo.score;
  }

  update(dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const vx = Math.cos(angle) * this.speed * dt;
    const vy = Math.sin(angle) * this.speed * dt;

    const oldX = this.x;
    this.x += vx;
    if (this.collidesWithWalls()) this.x = oldX;

    const oldY = this.y;
    this.y += vy;
    if (this.collidesWithWalls()) this.y = oldY;
  }

  collidesWithWalls() {
    const r = this.radius;
    for (let w of walls) {
      const closestX = clamp(this.x, w.x, w.x + w.w);
      const closestY = clamp(this.y, w.y, w.y + w.h);
      const dist = Math.hypot(this.x - closestX, this.y - closestY);
      if (dist < r) return true;
    }
    return false;
  }

  draw() {
    drawAlien(this.x, this.y, this.radius, this.color);
    drawHPBar(this.x, this.y, this.radius, this.hp, this.maxHp);
  }
}

// ==============================
// 子彈（不穿牆：小步進）
// ==============================
class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.radius = 4;
    this.life = 0.9;
    this.hitWall = false;
  }

  update(dt) {
    if (this.hitWall) return;

    const distThisFrame = Math.hypot(this.vx, this.vy) * dt;
    const steps = Math.max(1, Math.ceil(distThisFrame / this.radius));
    const stepDt = dt / steps;

    for (let s = 0; s < steps; s++) {
      this.x += this.vx * stepDt;
      this.y += this.vy * stepDt;

      if (bulletHitsAnyWall(this)) {
        this.hitWall = true;
        this.life = 0;
        break;
      }
    }

    this.life -= dt;
  }

  isOutOfBounds() {
    return (this.x < -20 || this.x > WIDTH + 20 || this.y < -20 || this.y > HEIGHT + 20);
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffdd99";
    ctx.fill();
  }
}

// ==============================
// 道具
// ==============================
class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.type = type; // heal | speed | shield
    this.life = 15;
  }

  update(dt) { this.life -= dt; }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

    if (this.type === "heal") ctx.fillStyle = "#ff4d6d";
    else if (this.type === "speed") ctx.fillStyle = "#3aa0ff";
    else ctx.fillStyle = "#ffd166";
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.type === "heal") ctx.fillText("+HP", 0, 0);
    else if (this.type === "speed") ctx.fillText("SPD", 0, 0);
    else ctx.fillText("S", 0, 0);

    ctx.restore();
  }
}

function spawnPowerup(x, y, type) {
  if (!type) return;
  powerups.push(new Powerup(x, y, type));
}

function applyPowerup(p) {
  if (p.type === "heal") player.hp = Math.min(player.maxHp, player.hp + 35);
  else if (p.type === "speed") player.speedBuffTimer = 8;
  else player.shieldTimer = 6;
}

// 紫色迷你獎勵：補滿血 + 給護盾
function applyPurpleMiniReward() {
  player.hp = player.maxHp;
  player.shieldTimer = Math.max(player.shieldTimer, 6);
}

// ==============================
// 生成敵人
// ==============================
function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = Math.random() * WIDTH; y = -20; }
  else if (edge === 1) { x = Math.random() * WIDTH; y = HEIGHT + 20; }
  else if (edge === 2) { x = -20; y = Math.random() * HEIGHT; }
  else { x = WIDTH + 20; y = Math.random() * HEIGHT; }

  const makePurple = Math.random() < purpleSpawnChance();
  const typeInfo = makePurple ? ENEMY_TYPES.PURPLE_MINI : randomNormalType();

  enemies.push(new Enemy(x, y, typeInfo));
}

// ==============================
// 控制：開始 / 暫停
// ==============================
function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  paused = false;
  gameOver = false;
  lastTime = performance.now(); // 避免 dt 暴衝
}

function togglePause() {
  if (!gameStarted) return;     // 尚未開始不給暫停
  if (gameOver) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "▶ 繼續 (P)" : "⏸ 暫停 (P)";
  shooting = false;
}

// ==============================
// 更新（核心）
// ==============================
function update(dt) {
  if (!gameStarted) return;     // 沒按開始就不更新
  if (paused || gameOver) return;

  player.update(dt);

  const maxEnemies = getMaxEnemies();
  const spawnInterval = getSpawnInterval();

  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < maxEnemies) {
    spawnEnemy();
    spawnTimer = spawnInterval;
  }

  for (let e of enemies) e.update(dt);
  for (let b of bullets) b.update(dt);
  for (let p of powerups) p.update(dt);

  // 子彈打敵人
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (b.hitWall || b.life <= 0) continue;

      const dist = Math.hypot(e.x - b.x, e.y - b.y);
      if (dist < e.radius + b.radius) {
        bullets.splice(j, 1);
        e.hp -= 1;

        if (e.hp <= 0) {
          // 紫色迷你：分數加倍
          const gained = (e.type === ENEMY_TYPES.PURPLE_MINI.key) ? (e.baseScore * 2) : e.baseScore;
          score += gained;

          // 掉落/獎勵
          if (e.type === ENEMY_TYPES.PURPLE_MINI.key) {
            applyPurpleMiniReward();
          } else {
            spawnPowerup(e.x, e.y, e.drop);
          }

          enemies.splice(i, 1);
        }
        break;
      }
    }
  }

  // 敵人碰玩家
  for (let e of enemies) {
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (dist < e.radius + player.radius) {
      if (!player.hasShield()) {
        player.hp -= 30 * dt;
        if (player.hp <= 0) {
          player.hp = 0;
          gameOver = true;
          paused = false;
          pauseBtn.textContent = "⏸ 暫停 (P)";
          
          // ★ 新增：上傳分數
          if (!dataUploaded) {
              dataUploaded = true;
              uploadScore();
          }
        }
      }
    }
  }

  // 吃道具
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const dist = Math.hypot(p.x - player.x, p.y - player.y);

    if (dist < p.radius + player.radius) {
      applyPowerup(p);
      powerups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) powerups.splice(i, 1);
  }

  bullets = bullets.filter((b) => b.life > 0 && !b.isOutOfBounds() && !b.hitWall);

  // UI
  hpText.textContent = `${player.hp.toFixed(0)} / ${player.maxHp}`;
  scoreText.textContent = score;
  alienCountText.textContent = enemies.length;

  let buffs = [];
  if (player.speedBuffTimer > 0) buffs.push(`Speed ${player.speedBuffTimer.toFixed(1)}s`);
  if (player.shieldTimer > 0) buffs.push(`Shield ${player.shieldTimer.toFixed(1)}s`);
  buffText.textContent = buffs.length ? buffs.join(" | ") : "None";
}

// ==============================
// 繪圖
// ==============================
function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // 背景網格
  ctx.strokeStyle = "#252b33";
  ctx.lineWidth = 1;

  for (let x = 0; x <= WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 牆
  for (let w of walls) {
    ctx.fillStyle = "#3b4250";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = "#111";
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  // 物件
  for (let p of powerups) p.draw();
  for (let b of bullets) b.draw();
  for (let e of enemies) e.draw();
  player.draw();

  // Game Over
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#fff";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 10);

    ctx.font = "18px sans-serif";
    ctx.fillText("按 R 或右側按鈕重新開始", WIDTH / 2, HEIGHT / 2 + 28);
  }

  // 暫停遮罩
  if (paused) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);

    ctx.font = "16px sans-serif";
    ctx.fillText("Press P to Resume", WIDTH / 2, HEIGHT / 2 + 30);
  }

  // 未開始遮罩（最重要：先看介紹）
  if (!gameStarted) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "38px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("READY?", WIDTH / 2, HEIGHT / 2 - 20);

    ctx.font = "18px sans-serif";
    ctx.fillText("請先閱讀上方說明，然後按右側「開始遊戲」或 Enter", WIDTH / 2, HEIGHT / 2 + 20);
  }
}

// ==============================
// 主迴圈
// ==============================
function loop(timestamp) {
  const dt = (timestamp - lastTime) / 1000 || 0;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// ==============================
// 重置（重開後回到未開始）
// ==============================
function resetGame() {
  player = new Player();
  enemies = [];
  bullets = [];
  powerups = [];

  spawnTimer = 0.5;

  gameOver = false;
  paused = false;

  gameStarted = false; // 重開後讓你可以再看介紹
  dataUploaded = false; // ★ 重置旗標


  score = 0;

  pauseBtn.textContent = "⏸ 暫停 (P)";
  lastTime = performance.now();
}

// ==============================
// 上傳分數 API
// ==============================
async function uploadScore() {
    const username = localStorage.getItem('logged_in_username');
    // ★ 100 分換 1 碎片
    const fragments = Math.floor(score / 100); 

    if (username && fragments > 0) {
        try {
            await fetch('/api/game_complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    game: 'shooter',
                    fragments: fragments
                })
            });
            console.log("Score uploaded");
        } catch (e) {
            console.error("Upload failed", e);
        }
    }
}

// ==============================
// 事件
// ==============================
window.addEventListener("keydown", (e) => {
  // Enter：開始
  if (e.code === "Enter") startGame();

  // P：暫停/繼續
  if (e.code === "KeyP") togglePause();

  // R：重開（回到未開始）
  if (e.code === "KeyR") resetGame();

  // 空白鍵：射擊（未開始/暫停/結束不射）
  if (e.code === "Space") {
    if (gameStarted && !paused && !gameOver) shooting = true;
    e.preventDefault();
  }

  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") shooting = false;
  keys[e.code] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", () => {
  if (gameStarted && !paused && !gameOver) shooting = true;
});

canvas.addEventListener("mouseup", () => {
  shooting = false;
});

// 按鈕
startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);

// Back
document.getElementById("back-btn").addEventListener("click", () => {
  window.location.href = "/game";
});

// ==============================
// 啟動：進頁面先 reset（未開始）+ 開始渲染回圈
// ==============================
resetGame();
requestAnimationFrame(loop);