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
