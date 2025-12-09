// === 遊戲參數 ===
// 如果你想要 16x8，就改成 ROWS=16, COLS=8
const ROWS = 10;   // 盤面高度
const COLS = 15;   // 盤面寬度
const TICK_MS = 500;       // 自動下落的時間間隔（毫秒）
const MAX_VALUE = 20;      // 達到 20 就收走

// DOM 元素
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const maxTileEl = document.getElementById("max-tile");
const statusTextEl = document.getElementById("status-text");
const startBtn = document.getElementById("start-btn");

// 根據欄數設定 CSS grid（配合你 CSS 裡的 cell 32px）
// boardEl.style.gridTemplateColumns = `repeat(${COLS}, 32px)`; // <-- 註釋或移除此行，改由 CSS 處理

// === 遊戲狀態 ===
let board = [];            // 固定方塊的棋盤 (ROWS x COLS)
let currentPiece = null;   // 正在下落的方塊 {row, col, value}
let score = 0;             // 收集到多少個 20
let maxTile = 0;           // 目前盤面最大數字
let gameOver = false;
let timerId = null;

// 滑鼠拖曳狀態
let isDragging = false;
let dragType = null;       // "current" or "board"
let dragRow = null;        // 拖曳中的方塊 row
let dragCol = null;        // 拖曳中的方塊 col

// 初始化空棋盤
function createEmptyBoard() {
  const arr = [];
  for (let r = 0; r < ROWS; r++) {
    const row = new Array(COLS).fill(0);
    arr.push(row);
  }
  return arr;
}

// 隨機整數 [min, max]
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 根據數字決定顏色
function getTileColor(v) {
  if (v <= 0) return "#020617";
  const hue = (v * 22) % 360;
  const lightness = 40 + Math.min(v * 2, 20); // 數字越大，稍微亮一點
  return `hsl(${hue}, 65%, ${lightness}%)`;
}

// 重新繪製畫面
function render() {
  boardEl.innerHTML = "";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let val = board[r][c];
      let isFalling = false;

      // 若此格是正在掉的方塊
      if (currentPiece && currentPiece.row === r && currentPiece.col === c) {
        val = currentPiece.value;
        isFalling = true;
      }

      const cell = document.createElement("div");
      cell.classList.add("cell");

      if (val === 0) {
        cell.classList.add("empty");
      } else {
        cell.classList.add("tile");
        cell.style.backgroundColor = getTileColor(val);
        cell.textContent = val;
      }

      if (isFalling) {
        cell.classList.add("falling");
      }

      boardEl.appendChild(cell);
    }
  }

  scoreEl.textContent = score;
  maxTileEl.textContent = maxTile;
}

// 產生新的掉落方塊
function spawnPiece() {
  const value = randomInt(1, 3);      // 初始數字 1~3
  const startCol = Math.floor(COLS / 2);

  // 若最上排該位置被佔，代表無法再生，新方塊生不出來，遊戲結束
  if (board[0][startCol] !== 0) {
    endGame();
    return;
  }

  currentPiece = {
    row: 0,
    col: startCol,
    value: value,
  };

  statusTextEl.textContent =
    "遊戲中：方塊會自動下落，任何沒被擋住的方塊都可以用滑鼠橫向拖動。";
}

// 檢查 (r, c) 是否可以有「掉落中的方塊」站在那格
function canMoveTo(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  if (board[r][c] !== 0) return false;
  return true;
}

// 每一個 tick：自動往下掉
function tick() {
  if (gameOver) return;

  if (!currentPiece) {
    spawnPiece();
  } else {
    moveDownOneStep();
  }

  render();
}

// 掉落一格
function moveDownOneStep() {
  if (!currentPiece) return;

  const nextRow = currentPiece.row + 1;
  const col = currentPiece.col;

  if (canMoveTo(nextRow, col)) {
    currentPiece.row = nextRow;
  } else {
    // 下面有東西or出界 -> 固定
    placePiece();
  }
}

// 把正在掉的方塊放到盤面上
function placePiece() {
  if (!currentPiece) return;
  const { row, col, value } = currentPiece;

  if (row < 0) {
    endGame();
    return;
  }

  board[row][col] = value;
  if (value > maxTile) maxTile = value;
  currentPiece = null;

  resolveBoard();  // 處理合併 & 收走 20
}

// 檢查同數字群組合併、重力、移除 >=20
function resolveBoard() {
  let changed = false;

  do {
    changed = false;

    // 1. 找同數字連通群組（上下左右）
    const visited = Array.from({ length: ROWS }, () =>
      new Array(COLS).fill(false)
    );

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board[r][c];
        if (v <= 0 || v >= MAX_VALUE) continue;
        if (visited[r][c]) continue;

        const queue = [{ r, c }];
        const group = [{ r, c }];
        visited[r][c] = true;

        while (queue.length > 0) {
          const { r: cr, c: cc } = queue.shift();
          const neighbors = [
            { nr: cr - 1, nc: cc },
            { nr: cr + 1, nc: cc },
            { nr: cr, nc: cc - 1 },
            { nr: cr, nc: cc + 1 },
          ];

          for (const { nr, nc } of neighbors) {
            if (
              nr >= 0 &&
              nr < ROWS &&
              nc >= 0 &&
              nc < COLS &&
              !visited[nr][nc] &&
              board[nr][nc] === v
            ) {
              visited[nr][nc] = true;
              queue.push({ r: nr, c: nc });
              group.push({ r: nr, c: nc });
            }
          }
        }

        // 若有至少兩格相鄰同數字，合併成 v+1
        if (group.length >= 2) {
          changed = true;

          // 合併位置：選「最下面、若同一列則最左」
          let target = group[0];
          for (const cell of group) {
            if (
              cell.r > target.r ||
              (cell.r === target.r && cell.c < target.c)
            ) {
              target = cell;
            }
          }

          // 清掉整個 group
          for (const cell of group) {
            board[cell.r][cell.c] = 0;
          }

          // 在 target 放新的 v+1
          const newVal = v + 1;
          board[target.r][target.c] = newVal;
          if (newVal > maxTile) maxTile = newVal;
        }
      }
    }

    // 2. 重力：每一欄方塊往下掉
    applyGravity();

    // 3. 收掉所有 >= 20 的方塊
    let collectedThisRound = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] >= MAX_VALUE) {
          board[r][c] = 0;
          collectedThisRound++;
        }
      }
    }
    if (collectedThisRound > 0) {
      score += collectedThisRound; // 一顆 20 加一分
      changed = true;
      applyGravity();
    }
  } while (changed);
}

// 重力：每欄從下往上整理方塊
function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] > 0) {
        const v = board[r][c];
        board[r][c] = 0;
        board[writeRow][c] = v;
        writeRow--;
      }
    }
    for (let r = writeRow; r >= 0; r--) {
      board[r][c] = 0;
    }
  }
}

// 結束遊戲
function endGame() {
  gameOver = true;
  currentPiece = null;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  statusTextEl.textContent = `遊戲結束！你一共收集了 ${score} 個 20。`;
  render();
}

// 重新開始
function startGame() {
  board = createEmptyBoard();
  score = 0;
  maxTile = 0;
  gameOver = false;
  currentPiece = null;
  isDragging = false;
  dragType = null;

  // 設置 CSS 變數 COLS 的值，以便 CSS Grid 使用
  document.documentElement.style.setProperty('--cols', COLS);

  if (timerId) clearInterval(timerId);
  timerId = setInterval(tick, TICK_MS);

  statusTextEl.textContent =
    "遊戲中：方塊會自動下落，任何沒被擋住的方塊都可以用滑鼠橫向拖動。";
  render();
}

// === 鍵盤操控（當備用） ===
function handleKeyDown(e) {
  if (gameOver) return;
  if (!currentPiece) return;

  const key = e.key;
  let handled = false;

  if (key === "ArrowLeft") {
    const newCol = currentPiece.col - 1;
    if (canMoveTo(currentPiece.row, newCol)) {
      currentPiece.col = newCol;
      handled = true;
    }
  } else if (key === "ArrowRight") {
    const newCol = currentPiece.col + 1;
    if (canMoveTo(currentPiece.row, newCol)) {
      currentPiece.col = newCol;
      handled = true;
    }
  } else if (key === "ArrowDown") {
    moveDownOneStep();
    handled = true;
  } else if (key === "ArrowUp") {
    while (
      currentPiece &&
      canMoveTo(currentPiece.row + 1, currentPiece.col)
    ) {
      currentPiece.row += 1;
    }
    placePiece();
    handled = true;
  }

  if (handled) {
    e.preventDefault();
    render();
  }
}

// === 滑鼠拖曳邏輯 ===

// 把滑鼠座標轉成棋盤的 (row, col)
function getCellFromMouseEvent(e) {
  const rect = boardEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
    return null;
  }

  // 這裡不再依賴固定的 32px 寬度，而是使用 Grid 容器的實際寬度來計算
  const col = Math.floor((x / rect.width) * COLS);
  const row = Math.floor((y / rect.height) * ROWS);

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return null;
  }
  return { row, col };
}

// 判斷同一 row 上，fromCol 到 toCol 之間是否都沒有其他方塊（不含起點）
function canSlideRow(row, fromCol, toCol) {
  if (fromCol === toCol) return true;
  const step = toCol > fromCol ? 1 : -1;
  for (let c = fromCol + step; c !== toCol + step; c += step) {
    if (board[row][c] !== 0) {
      return false;
    }
  }
  return true;
}

// 滑鼠按下：決定要拖哪一顆方塊
function handleMouseDown(e) {
  if (gameOver) return;

  const cellPos = getCellFromMouseEvent(e);
  if (!cellPos) return;

  const { row, col } = cellPos;

  // 先看是不是正在掉的那一顆
  if (
    currentPiece &&
    currentPiece.row === row &&
    currentPiece.col === col
  ) {
    isDragging = true;
    dragType = "current";
    dragRow = row;
    dragCol = col;
    e.preventDefault();
    return;
  }

  // 再看是不是盤面上的固定方塊
  if (board[row][col] > 0) {
    // 檢查下面一格是否為空，若是空則不允許拖曳，除非它是最底層
    if (row + 1 < ROWS && board[row + 1][col] === 0) {
      // 不允許拖動懸空的固定方塊 (除非我們也實作了重力拖動，但目前沒有)
      return;
    }
    
    isDragging = true;
    dragType = "board";
    dragRow = row;
    dragCol = col;
    e.preventDefault();
    return;
  }
}

// 滑鼠移動：拖曳中的話，試圖把那一顆橫向移動
function handleMouseMove(e) {
  if (!isDragging || gameOver) return;

  const cellPos = getCellFromMouseEvent(e);
  if (!cellPos) return;

  const { row, col: targetCol } = cellPos;

  // 只允許「在同一 row」橫向拖曳
  if (row !== dragRow) return;

  if (dragType === "current" && currentPiece) {
    const fromCol = currentPiece.col;
    if (targetCol === fromCol) return;

    if (canSlideRow(currentPiece.row, fromCol, targetCol)) {
      currentPiece.col = targetCol;
      dragCol = targetCol;
      render();
    }
  } else if (dragType === "board") {
    const fromCol = dragCol;
    if (targetCol === fromCol) return;

    const val = board[dragRow][fromCol];
    if (val <= 0) {
      isDragging = false;
      dragType = null;
      return;
    }

    // 檢查路徑是否暢通
    if (!canSlideRow(dragRow, fromCol, targetCol)) {
      return;
    }

    // 目標格必須是空的
    if (board[dragRow][targetCol] !== 0) return;

    // 移動方塊
    board[dragRow][fromCol] = 0;
    board[dragRow][targetCol] = val;
    dragCol = targetCol;

    // ⭐ 這裡是關鍵：移動後立即處理合併，讓拖動感覺很順
    // 為了讓拖動更順暢，在拖動後立即觸發一次 resolveBoard()
    isDragging = false;
    dragType = null;
    dragRow = null;
    dragCol = null;

    resolveBoard();
    render();
  }
}

// 滑鼠放開：結束拖曳（如果沒有觸發上面的即時合併）
function handleMouseUp(e) {
  if (!isDragging) return;
  isDragging = false;
  dragType = null;
  dragRow = null;
  dragCol = null;
}

// 綁定事件
startBtn.addEventListener("click", startGame);
window.addEventListener("keydown", handleKeyDown);
boardEl.addEventListener("mousedown", handleMouseDown);
window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("mouseup", handleMouseUp);

// 初始畫面
board = createEmptyBoard();
// 初始時也設置一次 COLS 變數，以便 CSS 渲染初始畫面
document.documentElement.style.setProperty('--cols', COLS);
render();
statusTextEl.textContent =
  "按下「開始 / 重來」後，方塊會自動下落，可以用滑鼠拖動它們。";

// ===== Back 按鈕：回首頁 =====
document.getElementById("back-btn").addEventListener("click", () => {
  window.location.href = "/game"; 
  // 若你的首頁不是 "/", 例如 "/home"，就改成：
  // window.location.href = "/home";
});