const TILE_SIZE = 32;          // 每一格地圖的像素大小（32x32）
const COLS = 15;               // 地圖有多少欄（x 方向）
const ROWS = 15;               // 地圖有多少列（y 方向）

// ★ 控制玩家移動延遲（數字越小越靈敏）
const PLAYER_MOVE_DELAY = 3;   // 玩家每移動一次之間要等待的 frame 數（越小移動越快）

// 地圖 
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
    "SSSSSSSSSSSSSSS", // 每一行是一列地圖，共 15 個字元 = 15 格
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

// tile 種類的數字代碼
const TILE_EMPTY = 0;          // 空地
const TILE_BRICK = 1;          // 磚牆
const TILE_STEEL = 2;          // 鋼牆
const TILE_WATER = 3;          // 水
const TILE_BASE = 4;           // 基地

const canvas = document.getElementById("gameCanvas"); // 取得 HTML 中的 <canvas>
const ctx = canvas.getContext("2d");                  // 取得 2D 繪圖 context

// === 遊戲整體狀態 ===
let map = [];                 // 目前關卡的地圖資料（2D 陣列）
let player = null;            // 玩家坦克物件
let playerHP = 5;             // 玩家血量（被打 5 次才死）
let enemies = [];             // 敵人坦克陣列
let bullets = [];             // 所有在場上的子彈陣列
let base = null;              // 基地的位置 {x, y}
let gameState = "playing";    // 遊戲狀態："playing" | "win" | "lose"
let currentLevel = 0;         // 目前關卡索引（從 0 開始）
let score = 0;                // 總分數

// 紀錄按鍵是否被按著
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
};

// === 初始化當前關卡地圖 ===
function initMap() {
  map = [];                   // 清空地圖陣列
  enemies = [];               // 清空敵人
  bullets = [];               // 清空子彈
  player = null;              // 清空玩家物件
  base = null;                // 清空基地
  playerHP = 5;               // 重設玩家血量為 5
  gameState = "playing";      // 將遊戲狀態重設為進行中

  const LEVEL = LEVELS[currentLevel]; // 取得當前關卡的字串地圖

  for (let y = 0; y < ROWS; y++) {      // 逐列處理地圖
    const line = LEVEL[y];              // 取出第 y 列的字串
    const rowArr = [];                  // 準備一個新陣列代表第 y 列的 tile
    for (let x = 0; x < COLS; x++) {    // 逐格處理
      const ch = line[x];               // 取得該格的字元
      let tile = TILE_EMPTY;            // 預設為空地

      // 依照字元決定 tile 類型
      if (ch === "B") tile = TILE_BRICK;
      else if (ch === "S") tile = TILE_STEEL;
      else if (ch === "W") tile = TILE_WATER;
      else if (ch === "X") tile = TILE_BASE;
      else tile = TILE_EMPTY;

      rowArr.push(tile);               // 把 tile 推進該列陣列

      // 根據字元建立特別物件（玩家 / 敵人 / 基地）
      if (ch === "P") {
        // 玩家：藍色
        player = createTank(x, y, "up", "#00bfff"); // 建立一個坦克物件給玩家
      } else if (ch === "E") {
        // 敵人：紅色
        enemies.push(createTank(x, y, "up", "red")); // 建立敵人坦克丟進 enemies 陣列
      } else if (ch === "X") {
        base = { x, y };             // 記錄基地位置
      }
    }
    map.push(rowArr);                // 把這一列的 tile 陣列推進地圖
  }
}

// 建立坦克物件用的工廠函式
function createTank(gridX, gridY, dir, color) {
  return {
    x: gridX,             // 坦克所在格子的 x 座標（以格為單位）
    y: gridY,             // 坦克所在格子的 y 座標
    dir: dir,             // 坦克目前面向方向："up" | "down" | "left" | "right"
    color: color,         // 坦克顏色（玩家藍、敵人紅）
    moveCooldown: 0,      // 下一次可以移動前要等待的 frame 數
    fireCooldown: 0,      // 下一次可以開火前要等待的 frame 數
  };
}

// 判斷格子是否可以讓坦克進入
function canTankMoveTo(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false; // 超出地圖範圍不能走
  const t = map[y][x];                  // 取得該位置的 tile 類型
  // 水、鋼牆、基地都不能進入
  if (t === TILE_STEEL || t === TILE_WATER || t === TILE_BASE) return false;
  return t === TILE_EMPTY || t === TILE_BRICK; // 空地或磚牆可以嘗試走進去
}

// 子彈是否撞到牆/基地
function bulletHitsTile(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS)
    return { hit: true, destroy: false };

  const t = map[y][x];

  if (t === TILE_BRICK)
    return { hit: true, destroy: true };
  if (t === TILE_STEEL)
    return { hit: true, destroy: false };
  if (t === TILE_BASE)
    return { hit: true, destroy: "base" };

  return { hit: false, destroy: false };
}

// 方向字串轉換成 (dx, dy) 單步位移
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

  // 先依照按鍵更新方向（只改方向，不一定會移動）
  if (keys.ArrowUp) player.dir = "up";
  else if (keys.ArrowDown) player.dir = "down";
  else if (keys.ArrowLeft) player.dir = "left";
  else if (keys.ArrowRight) player.dir = "right";

  // 再處理移動
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

  // 射擊邏輯
  if (player.fireCooldown > 0) player.fireCooldown--;
  if (keys.Space && player.fireCooldown <= 0) {
    fireBullet(player);
    player.fireCooldown = 12;
  }
}

// 敵人 
function updateEnemies() {
  enemies.forEach((enemy) => {
    let targetDir = enemy.dir;

    if (player) {
      const see = enemySeePlayer(enemy, player);
      if (see) {
        targetDir = see.dir;

        // 看得到玩家，有機率射擊
        if (enemy.fireCooldown <= 0 && Math.random() < 0.5) {
          fireBullet(enemy);
          // ★ 調慢：看到玩家之後，行動間隔更久
          enemy.moveCooldown = (24 - currentLevel * 3) + Math.floor(Math.random() * 10);
        }
      } else {
        // 看不到玩家就有機率亂轉向
        if (Math.random() < 0.03) {
          const dirs = ["up", "down", "left", "right"];
          targetDir = dirs[Math.floor(Math.random() * dirs.length)];
        }
      }
    } else {
      // 沒有玩家了也隨機走
      if (Math.random() < 0.03) {
        const dirs = ["up", "down", "left", "right"];
        targetDir = dirs[Math.floor(Math.random() * dirs.length)];
      }
    }

    enemy.dir = targetDir;

    // 移動
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
      // ★ 調慢：基本移動冷卻變大 → 敵人走更慢
      enemy.moveCooldown = 12 + Math.floor(Math.random() * 8);
    }

    if (enemy.fireCooldown > 0) enemy.fireCooldown--;
  });

  enemies = enemies.filter((e) => !e.dead);
}

// 判斷敵人是否看得到玩家（同一列/同一行且中間沒有牆/基地）
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
    // ★ 玩家 & 敵人子彈速度分開：敵人子彈更慢
    speed: tank === player ? 0.35 : 0.10,
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

      // 打到玩家
      if (player && b.from !== player && b.x === player.x && b.y === player.y) {
        playerHP -= 1;
        if (playerHP <= 0) {
          player = null;
          gameState = "lose";
        }
        bullets.splice(i, 1);
        continue;
      }

      // 打到敵人
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

  // 全部敵人消滅 → 過關或全破
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

// 畫一台坦克（玩家或敵人）
function drawTank(tank) {
  if (!tank) return;
  const px = tank.x * TILE_SIZE;
  const py = tank.y * TILE_SIZE;

  ctx.fillStyle = tank.color;
  ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

  ctx.fillStyle = "#000";
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

// 畫出所有子彈
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

// 畫出畫面上方的資訊（HUD）
function drawHUD() {
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  let hpText = player ? `HP: ${playerHP}` : "HP: 0";
  ctx.fillText(hpText, 10, 18);
  ctx.fillText(`敵人數量: ${enemies.length}`, 10, 36);
  ctx.fillText(`分數: ${score}`, 10, 54);
  ctx.fillText(
    `關卡: ${currentLevel + 1} / ${LEVELS.length}`,
    10,
    72
  );
}

// 顯示勝利/失敗訊息與提示
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
  // N 重開遊戲 → 回到第 1 關、分數歸零，並且重設所有按鍵狀態
  if (e.key === "n" || e.key === "N") {
    currentLevel = 0;
    score = 0;
    // ★ 重設所有按鍵，避免重開後方向鍵或空白鍵還卡在 true
    for (let k in keys) {
      keys[k] = false;
    }
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