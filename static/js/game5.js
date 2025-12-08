// ========== 1. DOM 物件 ==========
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreSpan = document.getElementById("score");
const levelSpan = document.getElementById("level");
const targetSpan = document.getElementById("target");
const timerSpan = document.getElementById("timer");

// ========== 2. 夾子與狀態 ==========
const baseX = canvas.width / 2; // 夾子起點 x
const baseY = 80;               // 夾子起點 y

const STATE = {
  SWING: "swing",   // 左右擺動
  EXTEND: "extend", // 往外伸
  PULL: "pull",     // 往回拉
};

let state = STATE.SWING;

// 擺動角：以「垂直向下」為基準
let angleOffset = 0;      // 相對於垂直向下的偏移
let angleDir = 1;         // 1 = 往右, -1 = 往左
const swingRange = 0.8;   // 最大擺動弧度 (~45°)
const angleSpeed = 0.02;  // 擺動速度

// 繩子長度
let ropeLength = 80;
const minRopeLength = 80;
const maxRopeLength = 550;
const extendSpeed = 7;
const basePullSpeed = 7;

// 爪子判定範圍（越大越好抓）
const CLAW_CATCH_RADIUS = 28;

// 分數、關卡、目標分數（目標看「總分」）
let score = 0;
let currentLevelIndex = 0;   // 0 代表第 1 關
let currentTarget = 60;      // 第一關目標分數

// 計時器與遊戲狀態
let timeLeft = 60;
let gameOver = false;

// 抓到的物體（null 表示沒有）
let caughtItem = null;

// 地面物件
const items = [];

// ========== 3. 物件建立 ==========

function addItem(x, y, type) {
  if (type === "small") {
    items.push({
      x,
      y,
      type,
      radius: 18,
      value: 10,
      pullSpeed: 6,
    });
  } else if (type === "medium") {
    items.push({
      x,
      y,
      type,
      radius: 25,
      value: 20,
      pullSpeed: 5,
    });
  } else if (type === "large") {
    items.push({
      x,
      y,
      type,
      radius: 32,
      value: 30,
      pullSpeed: 4,
    });
  } else if (type === "rock") {
    items.push({
      x,
      y,
      type,
      radius: 20,
      value: 1,
      pullSpeed: 2,  // 石頭：拉回速度慢
    });
  }
}

// 隨機產生一關的物件（無限關卡用）
function loadLevel(levelIndex) {
  items.length = 0; // 清空上一關物件

  // 關卡編號從 0 開始，顯示要 +1
  const displayLevel = levelIndex + 1;

  // 這關要放多少金塊、石頭（可以自己調）
  const numGold = 5 + Math.min(levelIndex * 2, 12);    // 金塊數量隨關卡增加，上限大約 17
  const numRocks = 2 + Math.floor(levelIndex / 2);     // 石頭越挖越多

  let totalGoldScore = 0;

  // y 位置：關卡越深，整體越靠近底部
  function randomY() {
    const base = 340 + Math.min(levelIndex * 15, 160); // 越後面 base 越大 → 越下面
    const maxY = 540;
    return base + Math.random() * (maxY - base);
  }

  function randomX() {
    return 80 + Math.random() * 640; // 留左右邊界
  }

  // 先生成金塊
  for (let i = 0; i < numGold; i++) {
    const r = Math.random();
    let type;
    if (r < 0.5) type = "small";
    else if (r < 0.85) type = "medium";
    else type = "large";

    const x = randomX();
    const y = randomY();
    addItem(x, y, type);

    if (type === "small") totalGoldScore += 10;
    else if (type === "medium") totalGoldScore += 20;
    else totalGoldScore += 30;
  }

  // 再加石頭
  for (let i = 0; i < numRocks; i++) {
    const x = randomX();
    const y = randomY();
    addItem(x, y, "rock");
  }

  // 設定本關目標（用「總分」門檻，會越來越高）
  // 這裡用「第一關 60 分，之後每關多 40 分」的簡單規則
  currentTarget = 60 + levelIndex * 40;

  // 重設夾子狀態 & 計時
  state = STATE.SWING;
  ropeLength = minRopeLength;
  angleOffset = 0;
  angleDir = 1;
  caughtItem = null;

  timeLeft = 60;
  gameOver = false;

  // 更新 UI
  levelSpan.textContent = "關卡：" + displayLevel;
  targetSpan.textContent = "目標：" + currentTarget;
  timerSpan.textContent = "時間：" + timeLeft;
  scoreSpan.textContent = "分數：" + score;
}

// ========== 4. 計時器：每秒減一 ==========
function startTimer() {
  setInterval(() => {
    if (gameOver) return;

    timeLeft--;
    if (timeLeft < 0) timeLeft = 0;
    timerSpan.textContent = "時間：" + timeLeft;

    if (timeLeft <= 0) {
      // 時間到，判斷總分有沒有達標
      if (score >= currentTarget) {
        goToNextLevel();
      } else {
        gameOver = true;
      }
    }
  }, 1000);
}

// ========== 5. 進下一關 ==========
function goToNextLevel() {
  currentLevelIndex++;
  loadLevel(currentLevelIndex);  // 自動生成下一關
}

// ========== 6. 鍵盤操作 ==========
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (!gameOver && state === STATE.SWING) {
      state = STATE.EXTEND;
    }
    e.preventDefault();
  }

  if (e.key === "r" || e.key === "R") {
    // 重新整個遊戲
    score = 0;
    scoreSpan.textContent = "分數：" + score;
    currentLevelIndex = 0;
    loadLevel(currentLevelIndex);
  }
});

// ========== 7. 夾子運動邏輯 ==========
function update() {
  if (gameOver) return;

  if (state === STATE.SWING) {
    angleOffset += angleSpeed * angleDir;
    if (angleOffset > swingRange) {
      angleOffset = swingRange;
      angleDir = -1;
    } else if (angleOffset < -swingRange) {
      angleOffset = -swingRange;
      angleDir = 1;
    }
  } else if (state === STATE.EXTEND) {
    ropeLength += extendSpeed;

    const { tipX, tipY } = getClawTip();

    // 檢查是否碰到物件（用物體半徑 + 爪子判定半徑）
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const dx = tipX - it.x;
      const dy = tipY - it.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < it.radius + CLAW_CATCH_RADIUS) {
        caughtItem = it;
        items.splice(i, 1);
        state = STATE.PULL;
        break;
      }
    }

    if (ropeLength >= maxRopeLength && state === STATE.EXTEND) {
      state = STATE.PULL;
    }
  } else if (state === STATE.PULL) {
    let pullSpeed = basePullSpeed;
    if (caughtItem) pullSpeed = caughtItem.pullSpeed;

    ropeLength -= pullSpeed;

    if (ropeLength <= minRopeLength) {
      ropeLength = minRopeLength;

      if (caughtItem) {
        score += caughtItem.value;
        scoreSpan.textContent = "分數：" + score;
        caughtItem = null;

        // 在時間沒到之前，如果總分已經超過目標，也可以直接往下一關
        if (!gameOver && score >= currentTarget) {
          goToNextLevel();
        }
      }
      state = STATE.SWING;
    }
  }
}

// 夾子末端位置
function getClawTip() {
  const angle = Math.PI / 2 + angleOffset; // π/2 為正下方
  const tipX = baseX + ropeLength * Math.cos(angle);
  const tipY = baseY + ropeLength * Math.sin(angle);
  return { tipX, tipY, angle };
}

// ========== 8. 繪圖 ==========
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 地面
  ctx.fillStyle = "#003300";
  ctx.fillRect(0, 560, canvas.width, 40);

  // 礦工底座
  ctx.fillStyle = "#888";
  ctx.fillRect(baseX - 30, baseY - 20, 60, 20);
  ctx.fillStyle = "#ccc";
  ctx.fillRect(baseX - 10, baseY - 40, 20, 20);

  // 繩子 + 夾子
  const { tipX, tipY, angle } = getClawTip();

  // 繩子
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // 夾子：機械電動爪
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle - Math.PI / 2); // 讓爪子朝著繩子方向

  // 1. 馬達本體
  ctx.fillStyle = "#bbbbbb";
  ctx.fillRect(-7, -28, 14, 20);

  // 2. 關節
  ctx.fillStyle = "#888888";
  ctx.fillRect(-4, -8, 8, 12);

  // 3. 左右爪臂
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-18, 16);
  ctx.lineTo(-12, 22);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(18, 16);
  ctx.lineTo(12, 22);
  ctx.stroke();

  // 4. 爪尖端小金屬塊
  ctx.fillStyle = "#ffcc33";
  ctx.beginPath();
  ctx.arc(-12, 22, 3, 0, Math.PI * 2);
  ctx.arc(12, 22, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 抓到物件時，畫在夾子下方
  if (caughtItem) {
    ctx.beginPath();
    ctx.fillStyle = caughtItem.type === "rock" ? "#777" : "#ffd700";
    ctx.arc(tipX, tipY + caughtItem.radius, caughtItem.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 地上的物件
  for (const it of items) {
    ctx.beginPath();
    ctx.fillStyle = it.type === "rock" ? "#777" : "#ffd700";
    ctx.arc(it.x, it.y, it.radius, 0, Math.PI * 2);
    ctx.fill();

    // 顯示分數值
    ctx.fillStyle = "#000";
    ctx.font = "12px Microsoft JhengHei";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.value, it.x, it.y);
  }

  // 遊戲失敗畫面
  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff4444";
    ctx.font = "40px Microsoft JhengHei";
    ctx.textAlign = "center";
    ctx.fillText("挑戰失敗！", canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = "#ffffff";
    ctx.font = "22px Microsoft JhengHei";
    ctx.fillText(
      "按 R 重新開始",
      canvas.width / 2,
      canvas.height / 2 + 20
    );
  }
}

// ========== 9. 主迴圈 ==========
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ========== 10. 啟動 ==========
loadLevel(currentLevelIndex);  // 生成第 1 關
startTimer();
gameLoop();