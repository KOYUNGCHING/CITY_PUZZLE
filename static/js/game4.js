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
  return t === TILE_EMPTY || t === TILE_BRICK; // 空地或磚牆可以嘗試走進去（磚牆視為阻擋但你程式允許走，有點像貼牆）
}

// 子彈是否撞到牆/基地
function bulletHitsTile(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS)  // 子彈超出地圖範圍
    return { hit: true, destroy: false };        // 當作有撞到東西但不需要摧毀 tile

  const t = map[y][x];            // 取得該格的 tile 類型

  if (t === TILE_BRICK)           // 撞到磚牆：
    return { hit: true, destroy: true };   // 有撞到，並且要把磚牆拆掉
  if (t === TILE_STEEL)           // 撞到鋼牆：
    return { hit: true, destroy: false };  // 有撞到，但不會被摧毀
  if (t === TILE_BASE)            // 撞到基地：
    return { hit: true, destroy: "base" }; // 特別回傳 "base"

  // 水 / 空地：子彈可以穿過
  return { hit: false, destroy: false };
}

// 方向字串轉換成 (dx, dy) 單步位移
function dirToDelta(dir) {
  switch (dir) {
    case "up": return { dx: 0, dy: -1 };   // 往上 y 減 1
    case "down": return { dx: 0, dy: 1 };  // 往下 y 加 1
    case "left": return { dx: -1, dy: 0 }; // 往左 x 減 1
    case "right": return { dx: 1, dy: 0 }; // 往右 x 加 1
  }
}

// === 玩家相關 ===
function updatePlayer() {
  if (!player) return; // 如果玩家死了，就不更新

  // 先依照按鍵更新方向（只改方向，不一定會移動）
  if (keys.ArrowUp) player.dir = "up";
  else if (keys.ArrowDown) player.dir = "down";
  else if (keys.ArrowLeft) player.dir = "left";
  else if (keys.ArrowRight) player.dir = "right";

  // 再處理移動（用 PLAYER_MOVE_DELAY 控制靈敏度）
  if (player.moveCooldown > 0) {
    player.moveCooldown--;       // 再等一點時間才可以移動
  } else {
    // 若有任何方向鍵被按住，就嘗試往當前方向移動一格
    if (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight) {
      const { dx, dy } = dirToDelta(player.dir); // 取得方向對應的位移
      const nx = player.x + dx;                  // 計算下一格的 x
      const ny = player.y + dy;                  // 計算下一格的 y
      if (canTankMoveTo(nx, ny)) {               // 如果可以走就更新位置
        player.x = nx;
        player.y = ny;
      }
      player.moveCooldown = PLAYER_MOVE_DELAY;   // 重設移動冷卻時間
    }
  }

  // 射擊邏輯
  if (player.fireCooldown > 0) player.fireCooldown--;   // 冷卻時間減一
  if (keys.Space && player.fireCooldown <= 0) {         // 若按住空白鍵且冷卻結束
    fireBullet(player);                                 // 發射子彈
    player.fireCooldown = 12;                           // 設定下一次可射擊的延遲
  }
}

// 敵人 
function updateEnemies() {
  enemies.forEach((enemy) => {    // 逐一更新每一台敵人
    let targetDir = enemy.dir;    // 預設維持原方向

    if (player) {                 // 如果玩家還活著
      const see = enemySeePlayer(enemy, player); // 檢查敵人是否看得到玩家（同列/同行）
      if (see) {
        targetDir = see.dir;      // 若看得到，將方向轉向對著玩家

        // 若玩家在炮口方向且中間無阻擋，嘗試射擊
        if (enemy.fireCooldown <= 0 && Math.random() < 0.5) { // 有一定機率開火
          fireBullet(enemy);       // 敵人發射子彈
          // ★ 看見玩家時，同步設定移動冷卻，讓行為稍微連動
          enemy.moveCooldown = (18 - currentLevel * 3) + Math.floor(Math.random() * 8);
        }
      } else {
        // 看不到玩家就有機率亂轉向
        if (Math.random() < 0.03) {
          const dirs = ["up", "down", "left", "right"];
          targetDir = dirs[Math.floor(Math.random() * dirs.length)]; // 隨機方向
        }
      }
    } else {
      // 沒有玩家了也隨機走
      if (Math.random() < 0.03) {
        const dirs = ["up", "down", "left", "right"];
        targetDir = dirs[Math.floor(Math.random() * dirs.length)];
      }
    }

    enemy.dir = targetDir;  // 更新敵人方向

    // 移動
    if (enemy.moveCooldown > 0) {
      enemy.moveCooldown--;   // 冷卻中，等待
    } else {
      const { dx, dy } = dirToDelta(enemy.dir); // 根據方向取得位移
      const nx = enemy.x + dx;
      const ny = enemy.y + dy;
      if (canTankMoveTo(nx, ny)) {  // 若前面可以移動
        enemy.x = nx;
        enemy.y = ny;
      } else {
        // 撞到不能走的，就換方向
        const dirs = ["up", "down", "left", "right"];
        enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
      }
      enemy.moveCooldown = 7 + Math.floor(Math.random() * 5); // 基本移動冷卻（數字越小越快）
    }

    if (enemy.fireCooldown > 0) enemy.fireCooldown--; // 射擊冷卻減一
  });

  // 把被打死的敵人清掉（e.dead 為 true 的會被過濾掉）
  enemies = enemies.filter((e) => !e.dead);
}
