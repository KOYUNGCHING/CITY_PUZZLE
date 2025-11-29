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
