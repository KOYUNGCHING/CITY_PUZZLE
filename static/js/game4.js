// === 基本設定 ===
const TILE_SIZE = 32;
const COLS = 15;
const ROWS = 15;

// 遊戲名稱
const GAME_TITLE = "Neon Tank Survival";

// ★ 控制玩家移動延遲（數字越小越靈敏）
const PLAYER_MOVE_DELAY = 3;  // 可改 2 或 1 更快

// === 多關卡地圖 ===
// 符號說明：
// B = 磚牆（可打掉）
// S = 鋼牆（不可破壞）
// W = 水（坦克不能走，子彈可穿越）
// . = 空地
// P = 玩家出生點（藍色坦克）
// E = 敵人出生點（紅色坦克）
// X = 基地（被打爆就 Game Over）
const LEVELS = [
  // ---- Level 1：新手關 ----
  [
    "SSSSSSSSSSSSSSS",
    "S.BB..W...BB..S",
    "S.BBB.WW.BBB..S",
    "S.....WWW.....S",
    "S.BBB..W..BBB.S",
    "S..W..BBB..W..S",
    "S..W.......W..S",
    "S.BBBW.W.WBBB.S",
    "S..W.......W..S",
    "S..W..BBB..W..S",
    "S.BBB..W..BBB.S",
    "S.....WWW.....S",
    "S.BBB.WW.BBB..S",
    "S.P...B...E..XS",
    "SSSSSSSSSSSSSSS",
  ],
  // ---- Level 2：敵人變多、地形更亂 ----
  [
    "SSSSSSSSSSSSSSS",
    "S.P..B...W..E.S",
    "S.BBBBW.BBBB..S",
    "S.W...W....W..S",
    "S.W.BBBBBB.W..S",
    "S.W...W....W..S",
    "S.BBBBW.BBBB..S",
    "S.....W.W.....S",
    "S.BBBBB.W.BBB.S",
    "S.W.....W....WS",
    "S.W.BBBBBB.W.SS",
    "S.W.....W..E.SS",
    "S.BBBBB.W.BBBXS",
    "S....E.......SS",
    "SSSSSSSSSSSSSSS",
  ],
  // ---- Level 3：敵人多 + 夾擊 ----
  [
    "SSSSSSSSSSSSSSS",
    "S.P.....W....ES",
    "S.BBBB.W.BBBB.S",
    "S.W..E.W.E..W.S",
    "S.W.BBBBBBB.W.S",
    "S.W...W.W...W.S",
    "S.BBBB.W.BBBB.S",
    "S.....WWW.....S",
    "S.BBBB.W.BBBB.S",
    "S.W...W.W...W.S",
    "S.W.BBBBBBB.W.S",
    "S.W..E.W.E..W.S",
    "S.BBBB.W.BBBBXS",
    "S....E.W.E....S",
    "SSSSSSSSSSSSSSS",
  ],
];

// tile 種類
const TILE_EMPTY = 0;
const TILE_BRICK = 1;
const TILE_STEEL = 2;
const TILE_WATER = 3;
const TILE_BASE = 4;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// === 遊戲整體狀態 ===
let map = [];
let player = null;
let playerHP = 5;
let enemies = [];
let bullets = [];
let base = null;
let gameState = "playing"; // "playing" | "win" | "lose"
let currentLevel = 0;      // 目前在第幾關（0-based）
let score = 0;             // 總分數

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
};

// === 初始化當前關卡地圖 ===
function initMap() {
  map = [];
  enemies = [];
  bullets = [];
  player = null;
  base = null;
  playerHP = 5;
  gameState = "playing";

  const LEVEL = LEVELS[currentLevel];

  for (let y = 0; y < ROWS; y++) {
    const line = LEVEL[y];
    const rowArr = [];
    for (let x = 0; x < COLS; x++) {
      const ch = line[x];
      let tile = TILE_EMPTY;

      if (ch === "B") tile = TILE_BRICK;
      else if (ch === "S") tile = TILE_STEEL;
      else if (ch === "W") tile = TILE_WATER;
      else if (ch === "X") tile = TILE_BASE;
      else tile = TILE_EMPTY;

      rowArr.push(tile);

      if (ch === "P") {
        // 玩家：藍色
        player = createTank(x, y, "up", "#00bfff");
      } else if (ch === "E") {
        // 敵人：紅色
        enemies.push(createTank(x, y, "up", "red"));
      } else if (ch === "X") {
        base = { x, y };
      }
    }
    map.push(rowArr);
  }
}

// 建立坦克物件
function createTank(gridX, gridY, dir, color) {
  return {
    x: gridX,
    y: gridY,
    dir: dir,
    color: color,
    moveCooldown: 0,
    fireCooldown: 0,
  };
}

// 判斷格子是否可以讓坦克進入
function canTankMoveTo(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  const t = map[y][x];
  if (t === TILE_STEEL || t === TILE_WATER || t === TILE_BASE) return false;
  return t === TILE_EMPTY || t === TILE_BRICK;
}

// 子彈是否撞到牆/基地
function bulletHitsTile(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return { hit: true, destroy: false };
  const t = map[y][x];
  if (t === TILE_BRICK) return { hit: true, destroy: true };
  if (t === TILE_STEEL) return { hit: true, destroy: false };
  if (t === TILE_BASE) return { hit: true, destroy: "base" };
  return { hit: false, destroy: false };
}

// 方向轉位移
function dirToDelta(dir) {
  switch (dir) {
    case "up": return { dx: 0, dy: -1 };
    case "down": return { dx: 0, dy: 1 };
    case "left": return { dx: -1, dy: 0 };
    case "right": return { dx: 1, dy: 0 };
  }
}

// === 玩家相關 ===
function updatePlayer() {
  if (!player) return;

  if (keys.ArrowUp) player.dir = "up";
  else if (keys.ArrowDown) player.dir = "down";
  else if (keys.ArrowLeft) player.dir = "left";
  else if (keys.ArrowRight) player.dir = "right";

  if (player.moveCooldown > 0) {
    player.moveCooldown--;
  } else {
    if (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight) {
      const { dx, dy } = dirToDelta(player.dir);
      const nx = player.x + dx;
      const ny = player.y + dy;
      if (canTankMoveTo(nx, ny)) {
        player.x = nx;
        player.y = ny;
      }
      player.moveCooldown = PLAYER_MOVE_DELAY;
    }
  }

  if (player.fireCooldown > 0) player.fireCooldown--;
  if (keys.Space && player.fireCooldown <= 0) {
    fireBullet(player);
    player.fireCooldown = 12;
  }
}

// === 敵人 AI ===
function updateEnemies() {
  enemies.forEach((enemy) => {
    let targetDir = enemy.dir;

    if (player) {
      const see = enemySeePlayer(enemy, player);
      if (see) {
        targetDir = see.dir;

        // 看到玩家才有機會射擊
        if (enemy.fireCooldown <= 0 && Math.random() < 0.45) {
          fireBullet(enemy);
          // ★ 敵人射擊冷卻變久一點 → 子彈密度下降
          enemy.fireCooldown = 26 + Math.floor(Math.random() * 10);
          // ★ 看到玩家時移動也不要太快
          enemy.moveCooldown = 22 + Math.floor(Math.random() * 10);
        }
      } else {
        if (Math.random() < 0.03) {
          const dirs = ["up", "down", "left", "right"];
          targetDir = dirs[Math.floor(Math.random() * dirs.length)];
        }
      }
    } else {
      if (Math.random() < 0.03) {
        const dirs = ["up", "down", "left", "right"];
        targetDir = dirs[Math.floor(Math.random() * dirs.length)];
      }
    }

    enemy.dir = targetDir;

    // 移動速度整體變慢（數字越大越慢）
    if (enemy.moveCooldown > 0) {
      enemy.moveCooldown--;
    } else {
      const { dx, dy } = dirToDelta(enemy.dir);
      const nx = enemy.x + dx;
      const ny = enemy.y + dy;
      if (canTankMoveTo(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
      } else {
        const dirs = ["up", "down", "left", "right"];
        enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
      }
      // ★ 原本是 7 + rand(5)，現在改成 14 + rand(6) → 走路明顯變慢
      enemy.moveCooldown = 14 + Math.floor(Math.random() * 6);
    }

    if (enemy.fireCooldown > 0) enemy.fireCooldown--;
  });

  enemies = enemies.filter((e) => !e.dead);
}

// 判斷敵人是否看得到玩家
function enemySeePlayer(enemy, player) {
  if (enemy.x === player.x) {
    const dir = player.y < enemy.y ? "up" : "down";
    const step = player.y < enemy.y ? -1 : 1;
    for (let y = enemy.y + step; y !== player.y; y += step) {
      const t = map[y][enemy.x];
      if (t === TILE_BRICK || t === TILE_STEEL || t === TILE_BASE) return false;
    }
    return { dir };
  }
  if (enemy.y === player.y) {
    const dir = player.x < enemy.x ? "left" : "right";
    const step = player.x < enemy.x ? -1 : 1;
    for (let x = enemy.x + step; x !== player.x; x += step) {
      const t = map[enemy.y][x];
      if (t === TILE_BRICK || t === TILE_STEEL || t === TILE_BASE) return false;
    }
    return { dir };
  }
  return false;
}

// === 子彈相關 ===
function fireBullet(tank) {
  const { dx, dy } = dirToDelta(tank.dir);
  bullets.push({
    x: tank.x,
    y: tank.y,
    dir: tank.dir,
    offsetX: 0,
    offsetY: 0,
    // ★ 玩家子彈 0.35（原本），敵人子彈再調慢 → 0.12
    speed: tank === player ? 0.35 : 0.12,
    from: tank,
  });
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const { dx, dy } = dirToDelta(b.dir);

    b.offsetX += dx * b.speed;
    b.offsetY += dy * b.speed;

    if (Math.abs(b.offsetX) >= 1 || Math.abs(b.offsetY) >= 1) {
      b.x += Math.sign(b.offsetX);
      b.y += Math.sign(b.offsetY);
      b.offsetX = 0;
      b.offsetY = 0;

      if (b.x < 0 || b.x >= COLS || b.y < 0 || b.y >= ROWS) {
        bullets.splice(i, 1);
        continue;
      }

      const hitInfo = bulletHitsTile(b.x, b.y);
      if (hitInfo.hit) {
        if (hitInfo.destroy === true) {
          map[b.y][b.x] = TILE_EMPTY;
        } else if (hitInfo.destroy === "base") {
          gameState = "lose";
        }
        bullets.splice(i, 1);
        continue;
      }

      if (player && b.from !== player && b.x === player.x && b.y === player.y) {
        playerHP -= 1;
        if (playerHP <= 0) {
          player = null;
          gameState = "lose";
        }
        bullets.splice(i, 1);
        continue;
      }

      for (let e of enemies) {
        if (b.from !== e && b.x === e.x && b.y === e.y) {
          e.dead = true;
          score += 100 * (currentLevel + 1);
          bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  if (gameState === "playing" && enemies.length === 0 && player && base) {
    if (currentLevel < LEVELS.length - 1) {
      currentLevel++;
      initMap();
    } else {
      gameState = "win";
    }
  }
}

// === 繪製 ===
function drawMap() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = map[y][x];

      switch (tile) {
        case TILE_EMPTY: {
          ctx.fillStyle = "#222";
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          break;
        }

        case TILE_BRICK: {
          ctx.fillStyle = "#aa5522";
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          break;
        }

        case TILE_STEEL: {
          ctx.fillStyle = "#888888";
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          break;
        }

        case TILE_WATER: {
          ctx.fillStyle = "#204a9b";
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          break;
        }

        case TILE_BASE: {
          const cx = x * TILE_SIZE + TILE_SIZE / 2;
          const cy = y * TILE_SIZE + TILE_SIZE / 2;
          const r = TILE_SIZE * 0.35;

          ctx.fillStyle = "#0a0a12";
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k - Math.PI / 6;
            const px = cx + r * 1.1 * Math.cos(angle);
            const py = cy + r * 1.1 * Math.sin(angle);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = "#00eaff";
          ctx.lineWidth = 3;
          ctx.shadowBlur = 15;
          ctx.shadowColor = "#00eaff";
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = "#00cfff";
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#00cfff";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
          ctx.strokeStyle = "#6a00ff";
          ctx.lineWidth = 2;
          ctx.shadowBlur = 12;
          ctx.shadowColor = "#6a00ff";
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
          break;
        }
      }

      ctx.strokeStyle = "#111";
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

function drawTank(tank) {
  if (!tank) return;
  const px = tank.x * TILE_SIZE;
  const py = tank.y * TILE_SIZE;

  ctx.fillStyle = tank.color;
  ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

  const centerX = px + TILE_SIZE / 2;
  const centerY = py + TILE_SIZE / 2;
  const len = TILE_SIZE / 2;
  let endX = centerX;
  let endY = centerY;
  const d = dirToDelta(tank.dir);
  endX += d.dx * len;
  endY += d.dy * len;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(endX, endY);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function drawBullets() {
  ctx.fillStyle = "#ffff00";
  bullets.forEach((b) => {
    const px = (b.x + b.offsetX) * TILE_SIZE;
    const py = (b.y + b.offsetY) * TILE_SIZE;
    ctx.beginPath();
    ctx.arc(
      px + TILE_SIZE / 2,
      py + TILE_SIZE / 2,
      4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });
}

// HUD
function drawHUD() {
  ctx.fillStyle = "#fff";

  ctx.font = "18px sans-serif";
  const titleWidth = ctx.measureText(GAME_TITLE).width;
  ctx.fillText(GAME_TITLE, (canvas.width - titleWidth) / 2, 22);

  ctx.font = "14px sans-serif";
  let hpText = player ? `HP: ${playerHP}` : "HP: 0";
  ctx.fillText(hpText, 10, 40);
  ctx.fillText(`敵人數量: ${enemies.length}`, 10, 58);
  ctx.fillText(`分數: ${score}`, 10, 76);
  ctx.fillText(
    `關卡: ${currentLevel + 1} / ${LEVELS.length}`,
    10,
    94
  );
}

// 顯示勝利/失敗訊息
function drawGameState() {
  if (gameState === "playing") return;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);

  ctx.fillStyle = "#fff";
  ctx.font = "24px sans-serif";
  let text = "";
  if (gameState === "win") text = "全部通關！你是坦克之神 🎉";
  if (gameState === "lose") text = "你失敗了，基地或你被摧毀。";

  const textWidth = ctx.measureText(text).width;
  ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 2);

  ctx.font = "16px sans-serif";
  const t2 = "按 N 從第一關重新開始";
  const w2 = ctx.measureText(t2).width;
  ctx.fillText(t2, (canvas.width - w2) / 2, canvas.height / 2 + 30);
}

// === 主迴圈 ===
function gameLoop() {
  if (gameState === "playing") {
    if (player) updatePlayer();
    updateEnemies();
    updateBullets();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawTank(player);
  enemies.forEach(drawTank);
  drawBullets();
  drawHUD();
  drawGameState();

  requestAnimationFrame(gameLoop);
}

// === 鍵盤事件 ===
window.addEventListener("keydown", (e) => {
  if (e.key === "n" || e.key === "N") {
    currentLevel = 0;
    score = 0;
    initMap();
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    keys.Space = true;
  } else if (e.key in keys) {
    keys[e.key] = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    keys.Space = false;
  } else if (e.key in keys) {
    keys[e.key] = false;
  }
});

// === 初始化並開始 ===
initMap();
gameLoop();