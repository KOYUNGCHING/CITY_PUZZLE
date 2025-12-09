// === 取得畫布與 UI 元素 ===
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hpText = document.getElementById("hpText");
const scoreText = document.getElementById("scoreText");
const alienCountText = document.getElementById("alienCount");
const buffText = document.getElementById("buffText");
const restartBtn = document.getElementById("restartBtn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// === 輸入狀態 ===
const keys = {};
let mouseX = WIDTH / 2;
let mouseY = HEIGHT / 2;
let shooting = false;

// === 遊戲狀態 ===
let lastTime = 0;
let player;
let enemies = [];
let bullets = [];
let powerups = [];
let spawnTimer = 0;
let gameOver = false;
let score = 0;

// === 牆壁（不能穿過） ===
const walls = [
  // 中央一塊
  { x: 350, y: 230, w: 200, h: 30 },
  // 左上
  { x: 150, y: 120, w: 120, h: 30 },
  // 右下
  { x: 600, y: 400, w: 180, h: 30 },
  // 左下
  { x: 120, y: 380, w: 140, h: 30 },
  // 右上
  { x: 600, y: 160, w: 150, h: 30 }
];

// === 玩家與敵人、子彈、道具的 class ===
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
    this.fireRate = 0.18; // 秒
  }

  getSpeed() {
    return this.baseSpeed * (this.speedBuffTimer > 0 ? 1.6 : 1);
  }

  hasShield() {
    return this.shieldTimer > 0;
  }

  update(dt) {
    // 移動
    let dx = 0;
    let dy = 0;
    if (keys["ArrowUp"]) dy -= 1;
    if (keys["ArrowDown"]) dy += 1;
    if (keys["ArrowLeft"]) dx -= 1;
    if (keys["ArrowRight"]) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const speed = this.getSpeed();
    let nextX = this.x + dx * speed * dt;
    let nextY = this.y + dy * speed * dt;

    // 碰撞偵測：分開處理 X/Y，避免黏牆
    // X
    const oldX = this.x;
    this.x = nextX;
    if (this.collidesWithWalls()) {
      this.x = oldX;
    }
    // Y
    const oldY = this.y;
    this.y = nextY;
    if (this.collidesWithWalls()) {
      this.y = oldY;
    }

    // 邊界
    this.x = Math.max(this.radius, Math.min(WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(HEIGHT - this.radius, this.y));

    // Buff 計時
    if (this.speedBuffTimer > 0) this.speedBuffTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    // 開火冷卻
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (shooting) {
      this.tryShoot();
    }
  }

  collidesWithWalls() {
    const r = this.radius;
    const px = this.x;
    const py = this.y;
    for (let w of walls) {
      const closestX = clamp(px, w.x, w.x + w.w);
      const closestY = clamp(py, w.y, w.y + w.h);
      const dist = Math.hypot(px - closestX, py - closestY);
      if (dist < r) return true;
    }
    return false;
  }

  tryShoot() {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = this.fireRate;

    const angle = Math.atan2(mouseY - this.y, mouseX - this.x);
    const speed = 520;
    const bullet = new Bullet(
      this.x + Math.cos(angle) * this.radius,
      this.y + Math.sin(angle) * this.radius,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    bullets.push(bullet);
  }

  draw() {
    const angle = Math.atan2(mouseY - this.y, mouseX - this.x);

    // 可以略帶火柴人感：頭＋身體＋手＋腳
    ctx.save();
    ctx.translate(this.x, this.y);

    // 頭
    ctx.beginPath();
    ctx.arc(0, -18, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 身體
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 12);
    ctx.stroke();

    // 腿
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(-8, 26);
    ctx.moveTo(0, 12);
    ctx.lineTo(8, 26);
    ctx.stroke();

    // 手臂＋槍，朝向滑鼠
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(14, -2);
    ctx.stroke(); // 手臂

    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(30, -2);
    ctx.lineWidth = 3;
    ctx.stroke(); // 槍
    ctx.restore();

    // 护盾效果（有無敵時畫一圈光環）
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

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.speed = 110; // 比玩家慢
    this.hp = 2;
  }

  update(dt) {
    // 朝玩家移動
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const vx = Math.cos(angle) * this.speed * dt;
    const vy = Math.sin(angle) * this.speed * dt;

    // 分離處理 X/Y 碰撞
    const oldX = this.x;
    this.x += vx;
    if (this.collidesWithWalls()) {
      this.x = oldX;
    }

    const oldY = this.y;
    this.y += vy;
    if (this.collidesWithWalls()) {
      this.y = oldY;
    }
  }

  collidesWithWalls() {
    const r = this.radius;
    const px = this.x;
    const py = this.y;
    for (let w of walls) {
      const closestX = clamp(px, w.x, w.x + w.w);
      const closestY = clamp(py, w.y, w.y + w.h);
      const dist = Math.hypot(px - closestX, py - closestY);
      if (dist < r) return true;
    }
    return false;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 外星人身體
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#7ef9c4";
    ctx.fill();
    ctx.strokeStyle = "#033";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-5, -3, 3, 0, Math.PI * 2);
    ctx.arc(5, -3, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#033";
    ctx.fill();

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 4;
    this.life = 0.9; // 秒
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  isOutOfBounds() {
    return (
      this.x < -20 ||
      this.x > WIDTH + 20 ||
      this.y < -20 ||
      this.y > HEIGHT + 20
    );
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffdd99";
    ctx.fill();
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.type = type; // "heal" | "speed" | "shield"
    this.life = 15; // 秒
  }

  update(dt) {
    this.life -= dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

    if (this.type === "heal") {
      ctx.fillStyle = "#ff6b81";
    } else if (this.type === "speed") {
      ctx.fillStyle = "#6bc5ff";
    } else {
      ctx.fillStyle = "#ffe066";
    }
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

// === 工具函式 ===
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dist = Math.hypot(cx - closestX, cy - closestY);
  return dist < cr;
}

// === 道具處理 ===
function spawnPowerup(x, y) {
  const r = Math.random();
  let type;
  if (r < 0.4) type = "heal";
  else if (r < 0.7) type = "speed";
  else type = "shield";
  powerups.push(new Powerup(x, y, type));
}

function applyPowerup(powerup) {
  if (powerup.type === "heal") {
    player.hp = Math.min(player.maxHp, player.hp + 35);
  } else if (powerup.type === "speed") {
    player.speedBuffTimer = 8; // 8 秒
  } else if (powerup.type === "shield") {
    player.shieldTimer = 6; // 6 秒
  }
}

// === 敵人生成 ===
function spawnEnemy() {
  // 從四個邊隨機生成
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) {
    x = Math.random() * WIDTH;
    y = -20;
  } else if (edge === 1) {
    x = Math.random() * WIDTH;
    y = HEIGHT + 20;
  } else if (edge === 2) {
    x = -20;
    y = Math.random() * HEIGHT;
  } else {
    x = WIDTH + 20;
    y = Math.random() * HEIGHT;
  }
  const enemy = new Enemy(x, y);
  enemies.push(enemy);
}

// === 更新與繪圖 ===
function update(dt) {
  if (gameOver) return;

  player.update(dt);

  // 敵人生成（控制最大數量與時間）
  const maxEnemies = 10;
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < maxEnemies) {
    spawnEnemy();
    spawnTimer = 1.2; // 每 1.2 秒最多生一隻
  }

  // 更新敵人
  for (let e of enemies) {
    e.update(dt);
  }

  // 更新子彈
  for (let b of bullets) {
    b.update(dt);
  }

  // 更新道具
  for (let p of powerups) {
    p.update(dt);
  }

  // 子彈 & 敵人 碰撞
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const dist = Math.hypot(e.x - b.x, e.y - b.y);
      if (dist < e.radius + b.radius) {
        bullets.splice(j, 1);
        e.hp -= 1;
        if (e.hp <= 0) {
          // 死亡：加分並掉道具
          score += 10;
          spawnPowerup(e.x, e.y);
          enemies.splice(i, 1);
        }
        break;
      }
    }
  }

  // 敵人 & 玩家 碰撞
  for (let e of enemies) {
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (dist < e.radius + player.radius) {
      if (!player.hasShield()) {
        player.hp -= 25 * dt; // 連續撞會持續扣血
        if (player.hp <= 0) {
          player.hp = 0;
          gameOver = true;
        }
      }
    }
  }

  // 玩家 & 道具 碰撞
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (dist < p.radius + player.radius) {
      applyPowerup(p);
      powerups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) {
      powerups.splice(i, 1);
    }
  }

  // 子彈刪除
  bullets = bullets.filter((b) => b.life > 0 && !b.isOutOfBounds());

  // 更新 UI
  hpText.textContent = `${player.hp.toFixed(0)} / ${player.maxHp}`;
  scoreText.textContent = score;
  alienCountText.textContent = enemies.length;
  let buffs = [];
  if (player.speedBuffTimer > 0)
    buffs.push(`Speed ${player.speedBuffTimer.toFixed(1)}s`);
  if (player.shieldTimer > 0)
    buffs.push(`Shield ${player.shieldTimer.toFixed(1)}s`);
  buffText.textContent = buffs.length ? buffs.join(" | ") : "None";
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // 背景網格（只是美觀）
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

  // 道具
  for (let p of powerups) {
    p.draw();
  }

  // 子彈
  for (let b of bullets) {
    b.draw();
  }

  // 敵人
  for (let e of enemies) {
    e.draw();
  }

  // 玩家
  player.draw();

  // Game Over 文字
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#fff";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "20px sans-serif";
    ctx.fillText("按 R 或下方按鈕重新開始", WIDTH / 2, HEIGHT / 2 + 30);
  }
}

// === 主迴圈 ===
function loop(timestamp) {
  const dt = (timestamp - lastTime) / 1000 || 0;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// === 初始化與重設 ===
function resetGame() {
  player = new Player();
  enemies = [];
  bullets = [];
  powerups = [];
  spawnTimer = 0.5;
  gameOver = false;
  score = 0;
  lastTime = performance.now();
}

// === 事件 ===
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    shooting = true;
    e.preventDefault(); // 避免往下捲動
  }
  if (e.code === "KeyR") {
    resetGame();
  }
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    shooting = false;
  }
  keys[e.code] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", () => {
  shooting = true;
});

canvas.addEventListener("mouseup", () => {
  shooting = false;
});

restartBtn.addEventListener("click", resetGame);

// === 開始遊戲 ===
resetGame();
requestAnimationFrame(loop);