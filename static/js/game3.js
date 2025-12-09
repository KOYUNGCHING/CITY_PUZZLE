// =======================================
// 1. 取得畫布與畫圖環境、上方顯示用的 DOM 元素
// =======================================
const canvas = document.getElementById("gameCanvas"); // 取得 <canvas> 元素
const ctx = canvas.getContext("2d");                  // 取得 2D 畫圖環境(context)

const scoreSpan = document.getElementById("score");   // 顯示分數的 <span>
const levelSpan = document.getElementById("level");   // 顯示關卡的 <span>
const targetSpan = document.getElementById("target"); // 顯示目標分數的 <span>
const timerSpan = document.getElementById("timer");   // 顯示剩餘時間的 <span>

// =======================================
// 2. 爪子系統相關變數
// =======================================
const baseX = canvas.width / 2; // 爪子吊掛點的 x 座標（畫面頂端中間）
const baseY = 80;               // 爪子吊掛點的 y 座標（稍微往下）

// 定義爪子目前可能的狀態
const STATE = {
  SWING: "swing",   // 左右擺動階段
  EXTEND: "extend", // 繩子往下伸長階段
  PULL: "pull",     // 往回拉階段
};

let state = STATE.SWING; // 一開始設定為左右擺動狀態

// 角度相關：以「垂直向下」為基準
let angleOffset = 0;   // 目前相對於垂直向下的偏移角度（正負代表左右）
let angleDir = 1;      // 擺動方向：1 往右、-1 往左

// 擺動範圍與速度（之後會隨關卡調整）
let swingRange = 0.8;  // 最大偏移弧度（約 0.8 rad ≈ 45 度）
let angleSpeed = 0.02; // 每一禎更新時增加的角度量

// 繩子長度相關
let ropeLength = 80;           // 目前繩子長度
const minRopeLength = 80;      // 最短繩長（縮回來的長度）
const maxRopeLength = 550;     // 最長繩長（伸到底的長度）

const extendSpeed = 7;         // 伸長時每一禎增加的長度
const basePullSpeed = 7;       // 拉回時的基本速度

// 爪子抓取判定用的範圍（爪子周圍多大距離算碰到）
const CLAW_CATCH_RADIUS = 35;

// =======================================
// 3. 遊戲整體狀態變數
// =======================================
let score = 0;                 // 玩家目前總分
let currentLevelIndex = 0;     // 目前關卡的 index（0 代表第 1 關）
let currentTarget = 100;       // 目前關卡要達到的目標分數
let timeLeft = 60;             // 本關剩餘時間（秒）
let gameOver = false;          // 是否遊戲結束（失敗）

let caughtItem = null;         // 爪子目前抓到的物件（null 表示沒有）
let timerId = null;            // setInterval 的 id，用來避免重複啟動計時器

const items = [];              // 場上所有物件（外星人 + 隕石）存放在這個陣列

// =======================================
// 4. 可愛圓臉雙眼觸角外星人繪圖函式
// =======================================
// x, y：外星人中心座標
// r：外星人半徑（不同大小的外星人用不同 r）
// color：外星人主體顏色（預設是淡藍綠色）
function drawAlien(x, y, r, color = "#9369ffff") {

  // ----- 外星人圓臉主體 -----
  ctx.beginPath();
  ctx.fillStyle = color;           // 填色：外星人身體顏色
  ctx.arc(x, y, r, 0, Math.PI * 2); // 畫一個圓形（臉）
  ctx.fill();

  ctx.strokeStyle = "#000e44ff";     // 外框深色
  ctx.lineWidth = 0;               // 外框線粗
  ctx.stroke();                    // 描邊

  // ----- 兩隻大眼睛 -----
  const eyeOffset = r * 0.45;      // 雙眼左右偏移距離
  const eyeR = r * 0.25;           // 眼白半徑

  // 小工具函式：畫一隻眼睛（包含眼白 + 瞳孔）
  function drawEye(cx, cy) {
    // 眼白
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // 瞳孔
    ctx.beginPath();
    ctx.fillStyle = "#000000";
    ctx.arc(cx, cy, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 左眼
  drawEye(x - eyeOffset, y - r * 0.1);
  // 右眼
  drawEye(x + eyeOffset, y - r * 0.1);

  // ----- 觸角 -----
  const antennaY = y - r * 1.1;    // 觸角末端高度
  const ballR = r * 0.18;          // 觸角小球半徑

  ctx.strokeStyle = "#9369ffff";     // 觸角線顏色
  ctx.lineWidth = 4;               // 觸角線粗

  // 左觸角線
  ctx.beginPath();
  ctx.moveTo(x - r * 0.35, y - r * 0.4); // 從頭部上緣某點
  ctx.lineTo(x - r * 0.55, antennaY);    // 連到上方觸角小球位置
  ctx.stroke();

  // 右觸角線
  ctx.beginPath();
  ctx.moveTo(x + r * 0.35, y - r * 0.4);
  ctx.lineTo(x + r * 0.55, antennaY);
  ctx.stroke();

  // 左觸角小球
  ctx.beginPath();
  ctx.fillStyle = "#9369ffff";
  ctx.arc(x - r * 0.55, antennaY, ballR, 0, Math.PI * 2);
  ctx.fill();

  // 右觸角小球
  ctx.beginPath();
  ctx.fillStyle = "#9369ffff";
  ctx.arc(x + r * 0.55, antennaY, ballR, 0, Math.PI * 2);
  ctx.fill();
}

// =======================================
// 5. 隕石障礙物繪圖函式
// =======================================
// x, y：中心座標
// r：大小半徑（長短軸會乘不同係數，看起來像橢圓石頭）
function drawMeteor(x, y, r) {
  // 隕石本體
  ctx.beginPath();
  ctx.fillStyle = "#9b7653";                     // 棕色
  ctx.ellipse(x, y, r * 1.1, r * 0.9, 0, 0, Math.PI * 2); // 畫橢圓形
  ctx.fill();

  // 外框
  ctx.strokeStyle = "#4e342e";                   // 深棕色輪廓
  ctx.lineWidth = 3;
  ctx.stroke();

  // 裂縫線
  ctx.strokeStyle = "#3e2723";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.2);
  ctx.lineTo(x, y + r * 0.3);
  ctx.stroke();
}

// =======================================
// 6. 關卡生成：固定數量、稍微增加
// =======================================
function loadLevel(levelIndex) {
  items.length = 0;             // 清空上一關的物件
  gameOver = false;             // 確保不是失敗狀態
  timeLeft = 60;                // 每關時間重新設 60 秒

  let L = levelIndex + 1;       // 顯示用關卡數（index 0 對應第 1 關）

  // 各種外星人與隕石數量（有上限、稍微變多）
  const SMALL   = Math.min(3 + levelIndex, 5); // 小外星人：3 起跳，慢慢到 6 上限
  const MEDIUM  = Math.min(2 + levelIndex, 4); // 中外星人：2 起跳，最多 4
  const LARGE   = Math.min(1 + levelIndex, 2); // 大外星人：1 起跳，最多 2
  const METEORS = Math.min(2 + levelIndex, 5); // 隕石：2 起跳，最多 5

  // 隨機位置產生器
  function randX() { return 80 + Math.random() * 640; } // 左右留 80px 邊界
  function randY() { return 360 + Math.random() * 180; } // 大概在畫面下半部

  // 依數量生成外星人與隕石
  for (let i = 0; i < SMALL; i++)   addAlien("small");
  for (let i = 0; i < MEDIUM; i++)  addAlien("medium");
  for (let i = 0; i < LARGE; i++)   addAlien("large");

  for (let i = 0; i < METEORS; i++) {
    items.push({
      x: randX(),             // 隕石 x 座標
      y: randY(),             // 隕石 y 座標
      type: "meteor",         // 類型：隕石
      radius: 24,             // 半徑大小
      value: 1,               // 分數：幾乎沒用
      pullSpeed: 2            // 拉回速度很慢：代表很重
    });
  }

  // 內部工具函式：依 size 生成一個外星人
  function addAlien(size) {
    // 根據外星人大小決定半徑 r、得分 v
    const r = size === "small" ? 22 : size === "medium" ? 32 : 42;
    const v = size === "small" ? 15 : size === "medium" ? 30 : 45;

    // 第 10 關之後外星人會左右移動（speed 非 0）
    const speed =
      (levelIndex >= 9)       // index 9 = 第 10 關
        ? (Math.random() * 1.2 + 0.6) * (Math.random() < 0.5 ? 1 : -1) // 隨機方向與速度
        : 0;                   // 10 關之前不會移動

    items.push({
      x: randX(),             // 外星人 x 座標
      y: randY(),             // 外星人 y 座標
      type: "alien",          // 類型：外星人
      size,                   // 大小標記（"small"/"medium"/"large"）
      radius: r,              // 半徑
      value: v,               // 抓到可以得到的分數
      pullSpeed: size === "small" ? 6 : size === "medium" ? 5 : 4, // 拉回速度
      speed                    // 水平移動速度（第 10 關後才不是 0）
    });
  }

  // 目標分數：隨關卡線性上升
  currentTarget = 120 + levelIndex * 150;

  // 爪子擺動難度設定：關卡越高，擺越快、擺幅越大
  angleSpeed = 0.02 + levelIndex * 0.004; // 左右擺動速度增加
  swingRange = 0.8  + levelIndex * 0.05;  // 最大擺動角度增加

  // 重設爪子狀態
  ropeLength = minRopeLength; // 繩子縮回最短
  angleOffset = 0;            // 從正下方開始擺
  angleDir = 1;               // 先往右擺
  caughtItem = null;          // 沒抓到任何東西

  // 更新畫面上的關卡、目標、時間、分數文字
  levelSpan.textContent  = "關卡：" + L;
  targetSpan.textContent = "目標：" + currentTarget;
  timerSpan.textContent  = "時間：" + timeLeft;
  scoreSpan.textContent  = "分數：" + score;
}

// =======================================
// 7. 第 10 關之後外星人左右移動
// =======================================
function moveAliens() {
  // currentLevelIndex < 9 表示第 1~9 關（第 10 關 index = 9）
  if (currentLevelIndex < 9) return; // 10 關前不動作

  // 逐一檢查 items 中的物件
  for (const it of items) {
    if (it.type === "alien") {       // 只有外星人才會走動
      it.x += it.speed;             // x 座標加上水平速度

      // 如果超出左右邊界，就反彈（速度反向）
      if (it.x < 40 || it.x > canvas.width - 40) {
        it.speed *= -1;
      }
    }
  }
}

// =======================================
// 8. 啟動倒數計時（每秒減一）
// =======================================
function startTimer() {
  // 如果 timerId 已經存在，代表計時器已經開過，就不用再開一次
  if (timerId) return;

  timerId = setInterval(() => {
    if (gameOver) return;      // 若遊戲已結束，不再改變時間

    timeLeft--;                // 每秒減一
    timerSpan.textContent = "時間：" + timeLeft;

    if (timeLeft <= 0) {       // 倒數結束
      // 若達到目標分數 → 自動下一關
      if (score >= currentTarget) {
        currentLevelIndex++;
        loadLevel(currentLevelIndex);
      } else {
        // 否則遊戲失敗
        gameOver = true;
      }
    }
  }, 1000);                    // 每 1000ms（1 秒）執行一次
}

// =======================================
// 9. 鍵盤事件：空白鍵發射、R 重新開始
// =======================================
document.addEventListener("keydown", (e) => {
  // 空白鍵 → 在擺動狀態時發射
  if (e.code === "Space") {
    if (!gameOver && state === STATE.SWING) {
      state = STATE.EXTEND;    // 改為伸長狀態
    }
    e.preventDefault();        // 防止頁面往下捲動
  }

  // R 鍵 → 重新從第 1 關開始
  if (e.key === "r" || e.key === "R") {
    score = 0;                 // 分數歸零
    currentLevelIndex = 0;     // 回到第 1 關 index
    loadLevel(currentLevelIndex); // 重新載入第一關
  }
});

// =======================================
// 10. 遊戲邏輯更新（每禎）
// =======================================
function update() {
  if (gameOver) return;         // 若已遊戲結束，就不再更新

  moveAliens();                 // 先處理外星人左右移動（第 10 關後才會動）

  if (state === STATE.SWING) {
    // ----- 左右擺動階段 -----
    angleOffset += angleSpeed * angleDir; // 根據方向增加或減少角度

    // 超過最大擺動範圍時反向
    if (angleOffset > swingRange) {
      angleOffset = swingRange;
      angleDir = -1;
    }
    if (angleOffset < -swingRange) {
      angleOffset = -swingRange;
      angleDir = 1;
    }

  } else if (state === STATE.EXTEND) {
    // ----- 繩子往下伸長階段 -----
    ropeLength += extendSpeed;  // 繩子變長

    const { tipX, tipY } = getClawTip(); // 計算爪子尖端位置

    // 查看有沒有碰到任何物件
    for (let i = 0; i < items.length; i++) {
      const it = items[i];      // 第 i 個物件
      const dx = tipX - it.x;   // 爪子尖端與物件的 x 差距
      const dy = tipY - it.y;   // 爪子尖端與物件的 y 差距

      // 若爪子尖端與物件中心距離 < 物件半徑 + 爪子判定半徑 → 視為抓到
      if (Math.sqrt(dx * dx + dy * dy) < it.radius + CLAW_CATCH_RADIUS) {
        caughtItem = it;        // 爪子記住抓到哪個物件
        items.splice(i, 1);     // 從地上的物件陣列中移除它
        state = STATE.PULL;     // 進入拉回階段
        break;                  // 跳出 for 迴圈
      }
    }

    // 若繩子已經伸到最長 → 自動開始拉回
    if (ropeLength >= maxRopeLength) {
      state = STATE.PULL;
    }

  } else if (state === STATE.PULL) {
    // ----- 繩子往回拉階段 -----
    // 若抓到東西，拉回速度依物件重量決定；否則用基本拉回速度
    const pullSpeed = caughtItem ? caughtItem.pullSpeed : basePullSpeed;
    ropeLength -= pullSpeed;    // 繩子變短

    // 如果已縮回到最短長度
    if (ropeLength <= minRopeLength) {
      ropeLength = minRopeLength;

      if (caughtItem) {
        // 把該物件的分數加到總分裡
        score += caughtItem.value;
        scoreSpan.textContent = "分數：" + score;
        caughtItem = null;      // 爪子不再抓住東西

        // 如果在時間還沒結束前就達成目標 → 直接進下一關
        if (score >= currentTarget) {
          currentLevelIndex++;
          loadLevel(currentLevelIndex);
        }
      }

      // 拉回完成後回到擺動狀態
      state = STATE.SWING;
    }
  }
}

// =======================================
// 11. 繪圖：黑色背景 + 爪子 + 外星人 + 隕石 + 結束畫面
// =======================================
function draw() {
  // 先清空整個畫布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ----- 背景：整個黑黑的 -----
  ctx.fillStyle = "#000000";              // 黑色背景
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 計算爪子尖端位置與實際角度
  const { tipX, tipY, angle } = getClawTip();

  // ----- 畫繩子 -----
  ctx.strokeStyle = "#ffffff";            // 白色繩子
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);               // 從固定點出發
  ctx.lineTo(tipX, tipY);                 // 連到爪子尖端
  ctx.stroke();

  // ----- 畫機械爪子本體 -----
  ctx.save();                             // 存目前的座標系統
  ctx.translate(tipX, tipY);              // 原點移到爪子尖端
  ctx.rotate(angle - Math.PI / 2);        // 讓爪子朝向繩子方向

  // 爪子上方的小機械盒（馬達）
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(-6, -26, 12, 18);

  // 下方關節
  ctx.fillStyle = "#999999";
  ctx.fillRect(-4, -8, 8, 12);

  // 左右兩支爪臂
  ctx.strokeStyle = "#ffd700";            // 金色
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-16, 14);
  ctx.lineTo(-10, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(16, 14);
  ctx.lineTo(10, 20);
  ctx.stroke();

  ctx.restore();                          // 還原座標系統

  // ----- 畫爪子抓到的物體（跟在爪子下面） -----
  if (caughtItem) {
    const x = tipX;
    const y = tipY + caughtItem.radius;   // 讓物體貼在爪子下方

    if (caughtItem.type === "meteor") {
      // 抓到隕石
      drawMeteor(x, y, caughtItem.radius);
    } else {
      // 抓到外星人
      drawAlien(x, y, caughtItem.radius);
    }
  }

  // ----- 畫地面所有物體 -----
  for (const it of items) {
    if (it.type === "meteor") {
      // 地上的隕石
      drawMeteor(it.x, it.y, it.radius);
    } else {
      // 地上的外星人
      drawAlien(it.x, it.y, it.radius);
    }
  }

  // ----- 若遊戲失敗，畫出「挑戰失敗」遮罩 -----
  if (gameOver) {
    // 半透明黑色遮罩
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 紅色失敗字樣
    ctx.fillStyle = "#ff4444";
    ctx.font = "40px Microsoft JhengHei";
    ctx.textAlign = "center";
    ctx.fillText("挑戰失敗！", canvas.width / 2, canvas.height / 2);
  }
}

// =======================================
// 12. 計算爪子尖端座標與角度
// =======================================
function getClawTip() {
  const angle = Math.PI / 2 + angleOffset; // 以垂直向下為基準加上偏移角
  const tipX = baseX + ropeLength * Math.cos(angle); // 使用三角函數算出 x
  const tipY = baseY + ropeLength * Math.sin(angle); // 使用三角函數算出 y
  return { tipX, tipY, angle };                      // 回傳三個值
}

// =======================================
// 13. 主遊戲迴圈：每禎呼叫 update() + draw()
// =======================================
function gameLoop() {
  update();                        // 更新遊戲邏輯
  draw();                          // 畫出目前畫面
  requestAnimationFrame(gameLoop); // 要求下一禎再執行 gameLoop
}

// =======================================
// 14. 遊戲啟動：載入第 1 關、啟動計時器、開始主迴圈
// =======================================
loadLevel(currentLevelIndex); // 載入第 0 號關卡（實際顯示為第 1 關）
startTimer();                 // 啟動 60 秒倒數
gameLoop();                   // 開始無限循環的遊戲主迴圈

// ====== 新增：重新開始按鈕 ======
document.getElementById("restartBtn").addEventListener("click", () => {
  score = 0;
  currentLevelIndex = 0;
  loadLevel(currentLevelIndex);
});

// ====== 新增：回首頁按鈕 ======
document.getElementById("homeBtn").addEventListener("click", () => {
  // 如果你的首頁是 "/"
  window.location.href = "/game";
  // 若要導向其他頁，例如 "/index" 可改成：
  // window.location.href = "/index";
});