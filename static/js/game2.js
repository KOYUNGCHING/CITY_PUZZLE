// --- 遊戲設定 ---
const ROWS = 8;
const COLS = 8;
const BLOCK_SIZE = 64; 
const COLORS = [1, 2, 3, 4]; 

// ===== Combo（大消連續）=====
let bigClearStreak = 0;          // 連續大消次數（>=10 才算）
let lastBigClearAt = 0;          // 上一次大消時間
const BIG_CLEAR_MIN = 10;        // 一次至少消 10 個才算大消
const BIG_CLEAR_WINDOW_MS = 1600;// 兩次大消間隔 <= 1.6s 才算連續

// --- 提示資料庫 ---
const GAME_TIPS = [
    "Tip: 一次消除 15 個以上方塊，分數加倍！(x2)",
    "Tip: 前期關卡難度低，是累積超高分的好機會！",
    "Tip: 別急著消掉小的，試著把同色方塊湊在一起。",
    "Tip: 只要分數達標，時間可以累積到下一關喔。",
    "Tip: 方塊會從上方掉落，預判掉落位置能製造連鎖。",
    "Tip: 若盤面上沒有可消除的方塊，遊戲會直接結束！"
];

// --- 遊戲狀態 ---
let board = [];     
let score = 0;
let highScore = 0; // ★ 最高分變數 ★
let level = 1;
let timeLeft = 0;
let maxTime = 0;
let timerInterval = null;
let tipsInterval = null; 
let isAnimating = false;


let isGameRunning = false;
let isPaused = false; 

document.addEventListener("DOMContentLoaded", function() {
    // ★ 1. 讀取最高分 ★
    highScore = parseInt(localStorage.getItem('game2_high_score')) || 0;
    initGameStructure();
});

// --- 初始化結構 ---
function initGameStructure() {
    generateBoard(4); 
    isGameRunning = false;
    updateUI(0, 60); 
}

// --- 開始遊戲 ---
function startGameSession() {
    document.getElementById('game-overlay').classList.add('hidden');
    score = 0;
    level = 1;
    isGameRunning = true;
    isPaused = false;
    
    setupLevel(1);
    generateBoard(4);
    
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(gameLoop, 1000);
}

// --- ★★★ 暫停與提示功能 ★★★ ---
function togglePause() {
    if (!isGameRunning) return;

    const pauseOverlay = document.getElementById('pause-overlay');

    if (isPaused) {
        // 恢復
        isPaused = false;
        pauseOverlay.classList.add('hidden');
        startTimer(); 
        stopTipsRotation(); 
    } else {
        // 暫停
        isPaused = true;
        pauseOverlay.classList.remove('hidden');
        clearInterval(timerInterval); 
        startTipsRotation(); 
    }
}

function startTipsRotation() {
    showRandomTip();
    tipsInterval = setInterval(showRandomTip, 3000);
}

function stopTipsRotation() {
    clearInterval(tipsInterval);
}

function showRandomTip() {
    const tipElement = document.getElementById('tip-text');
    const randomIndex = Math.floor(Math.random() * GAME_TIPS.length);
    
    tipElement.style.opacity = 0;
    setTimeout(() => {
        tipElement.innerText = GAME_TIPS[randomIndex];
        tipElement.style.opacity = 1;
    }, 200);
}

function setupLevel(lv) {
    level = lv;
    const config = getLevelConfig(lv);
    maxTime = config.time;
    timeLeft = config.time;
    updateUI();
}

function getLevelConfig(lv) {
    const numColors = 4;
    // 1. 時間：第一關 60秒，之後每關 +10秒 (上限180)
    let time = 60 + (lv - 1) * 10;
    if (time > 180) time = 180;

    // 2. 分數：階梯式成長 (50 * lv * (lv+1))
    const target = 50 * lv * (lv + 1);

    return { target: target, colors: numColors, time: time };
}

// --- 生成棋盤 ---
function generateBoard(numColors) {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = '';
    ensureComboLayer();
    board = [];

    for(let r=0; r<ROWS; r++) {
        let rowData = [];
        for(let c=0; c<COLS; c++) rowData.push(null);
        board.push(rowData);
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let color = Math.floor(Math.random() * numColors) + 1;
            createBlock(r, c, color);
        }
    }

    if (!hasPossibleMoves()) generateBoard(numColors);
}

function createBlock(r, c, color) {
    let div = document.createElement('div');
    div.classList.add('block');
    div.classList.add(`color-${color}`);
    setPosition(div, r, c);

    div.onclick = () => handleBlockClick(div);
    div.onmouseenter = () => highlightGroup(div);
    div.onmouseleave = clearHighlights;

    document.getElementById('game-board').appendChild(div);
    board[r][c] = { color: color, el: div };
}

function setPosition(el, r, c) {
    el.style.top = (r * BLOCK_SIZE) + "px";
    el.style.left = (c * BLOCK_SIZE) + "px";
    el.dataset.r = r;
    el.dataset.c = c;
}

// --- 點擊邏輯 ---
async function handleBlockClick(divElement) {
    if (!isGameRunning || isPaused || isAnimating || timeLeft <= 0) return;

    let r = parseInt(divElement.dataset.r);
    let c = parseInt(divElement.dataset.c);

    if (board[r][c] === null) return;

    let group = findConnectedBlocks(r, c, board[r][c].color);

    if (group.length >= 3) {
        isAnimating = true;
        // ===== 大消連續 Combo 規則（一次>=10 才顯示；第一次就顯示 x1）=====
        if (group.length >= BIG_CLEAR_MIN) {
        const now = Date.now();

        // 時間窗內：連續大消 → streak+1；超過時間窗 → 重新從 1
        bigClearStreak = (now - lastBigClearAt <= BIG_CLEAR_WINDOW_MS) ? (bigClearStreak + 1) : 1;
        lastBigClearAt = now;

        // 顯示在被點到的方塊中心
        const boardEl = document.getElementById("game-board");
        const rectBoard = boardEl.getBoundingClientRect();
        const rectBlock = divElement.getBoundingClientRect();
        const px = (rectBlock.left - rectBoard.left) + rectBlock.width / 2;
        const py = (rectBlock.top  - rectBoard.top ) + rectBlock.height / 2;

        // 第一次大消也跳 x1
        comboBlastFx(px, py, bigClearStreak);
        }

        // group.length < 10：不跳任何東西（什麼都不做）
        // 顯示在被點到的方塊中心
        const boardEl = document.getElementById("game-board");
        const rectBoard = boardEl.getBoundingClientRect();
        const rectBlock = divElement.getBoundingClientRect();

        const px = (rectBlock.left - rectBoard.left) + rectBlock.width / 2;
        const py = (rectBlock.top  - rectBoard.top ) + rectBlock.height / 2;


        // ★★★ 15+ Combo 雙倍分 ★★★
        // 15+ 仍保留 x2
        let multiplier = 1;
        if (group.length >= 15) multiplier = 2;

        // Combo 額外加成（上限避免爆分）
        if (group.length >= 15) {
            multiplier = 2;
            console.log("Big Combo! x2 Points");
        }
        
        score += (group.length * multiplier); 
        
        // ★ 2. 更新最高分 ★
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('game2_high_score', highScore);
        }

        updateUI();

        group.forEach(pos => {
            let blockObj = board[pos.r][pos.c];
            if(blockObj) blockObj.el.classList.add('vanishing');
        });

        await new Promise(r => setTimeout(r, 200));

        group.forEach(pos => {
            let blockObj = board[pos.r][pos.c];
            if(blockObj && blockObj.el) blockObj.el.remove();
            board[pos.r][pos.c] = null;
        });

        applyGravityAndSpawn();
        
        await new Promise(r => setTimeout(r, 450));
        isAnimating = false;

        if (!hasPossibleMoves()) gameOver(true);
    }
}

// --- 重力與生成 ---
function applyGravityAndSpawn() {
    const colors = 4; 

    for (let c = 0; c < COLS; c++) {
        let writeRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] !== null) {
                if (writeRow !== r) {
                    board[writeRow][c] = board[r][c];
                    board[r][c] = null;
                    setPosition(board[writeRow][c].el, writeRow, c);
                }
                writeRow--;
            }
        }

        while (writeRow >= 0) {
            let newColor = Math.floor(Math.random() * colors) + 1;
            let div = document.createElement('div');
            div.classList.add('block', `color-${newColor}`);
            
            let finalTop = writeRow * BLOCK_SIZE;
            div.style.top = "-70px"; 
            div.style.left = (c * BLOCK_SIZE) + "px";
            div.dataset.r = writeRow;
            div.dataset.c = c;

            div.onclick = () => handleBlockClick(div);
            div.onmouseenter = () => highlightGroup(div);
            div.onmouseleave = clearHighlights;

            document.getElementById('game-board').appendChild(div);
            board[writeRow][c] = { color: newColor, el: div };

            div.offsetHeight; 
            div.style.top = finalTop + "px";
            writeRow--;
        }
    }
}

// --- Flood Fill ---
function findConnectedBlocks(r, c, targetColor) {
    let group = [];
    let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let stack = [{r, c}];
    visited[r][c] = true;

    while (stack.length > 0) {
        let current = stack.pop();
        group.push(current);
        let neighbors = [
            {r: current.r - 1, c: current.c}, {r: current.r + 1, c: current.c},
            {r: current.r, c: current.c - 1}, {r: current.r, c: current.c + 1}
        ];
        for (let n of neighbors) {
            if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                if (!visited[n.r][n.c] && board[n.r][n.c] !== null && board[n.r][n.c].color === targetColor) {
                    visited[n.r][n.c] = true;
                    stack.push(n);
                }
            }
        }
    }
    return group;
}

function highlightGroup(divElement) {
    if(!isGameRunning || isPaused) return;
    
    let r = parseInt(divElement.dataset.r);
    let c = parseInt(divElement.dataset.c);
    if (!board[r][c]) return;
    let group = findConnectedBlocks(r, c, board[r][c].color);
    if (group.length >= 3) {
        group.forEach(pos => {
            if(board[pos.r][pos.c]) board[pos.r][pos.c].el.classList.add('connected-hint');
        });
    }
}
function clearHighlights() {
    document.querySelectorAll('.block').forEach(b => b.classList.remove('connected-hint'));
}
function hasPossibleMoves() {
    let checked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== null && !checked[r][c]) {
                let group = findConnectedBlocks(r, c, board[r][c].color);
                if (group.length >= 3) return true;
                group.forEach(g => checked[g.r][g.c] = true);
            }
        }
    }
    return false;
}

// --- 遊戲循環 ---
function gameLoop() {
    if (isPaused) return;

    timeLeft--;
    updateUI();
    const config = getLevelConfig(level);

    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (score >= config.target) {
            levelUp();
        } else {
            gameOver(false);
        }
    }
}

function levelUp() {
    document.body.style.backgroundColor = "#223"; 
    setTimeout(() => { document.body.style.backgroundColor = "#0d0d15"; }, 200);
    level++;
    setupLevel(level); 
    startTimer(); 
}

async function gameOver(isDeadlock) {
    clearInterval(timerInterval);
    isGameRunning = false;
    
    let fragments = Math.floor(score / 100);
    let reason = isDeadlock ? "DEADLOCK (No Moves)" : "TIME'S UP";
    
    try {
        await fetch('/api/game_complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game: 'collapse',
                level: level,
                score: score,
                fragments: fragments
            })
        });
    } catch (e) {
        console.log("Offline mode");
    }

    showEndScreen(reason, fragments);
}

function showEndScreen(reason, fragments) {
    const overlay = document.getElementById('game-overlay');
    const title = document.getElementById('overlay-title');
    const desc = document.getElementById('overlay-desc');
    const btn = document.querySelector('.start-btn');

    title.innerText = "MISSION FAILED";
    title.style.color = "#ff3333";
    
    desc.innerHTML = `
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Level Reached:</strong> ${level}</p>
        <p><strong>Total Score:</strong> ${score}</p>
        <p><strong>High Score:</strong> ${highScore}</p>
        <p><strong>Fragments Collected:</strong> ${fragments}</p>
        <p style="margin-top: 20px;">The city needs more energy.</p>
    `;

    btn.innerText = "TRY AGAIN";
    btn.onclick = startGameSession; 
    overlay.classList.remove('hidden');
}

function updateUI() {
    const config = getLevelConfig(level) || { target: 100 }; 
    
    document.getElementById('level-display').innerText = level;
    document.getElementById('score-text').innerText = `${score} / ${config.target}`;
    
    // ★ 3. 更新 UI ★
    document.getElementById('high-score-display').innerText = highScore;
    
    const bar = document.getElementById('timer-bar');
    let percentage = (timeLeft / maxTime) * 100;
    if (percentage < 0) percentage = 0;
    
    bar.style.width = percentage + "%";
    
    if (timeLeft <= 5) bar.classList.add('critical');
    else bar.classList.remove('critical');

    let frags = Math.floor(score / 100);
    document.getElementById('fragment-display').innerText = frags;
}
function showComboFx(text, px, py, isBig=false) {
    const layer = document.getElementById("combo-layer");
    if (!layer) return;

    const el = document.createElement("div");
    el.className = "combo-fx" + (isBig ? " big" : "");
    el.textContent = text;
    el.style.left = px + "px";
    el.style.top  = py + "px";

    layer.appendChild(el);

    // 動畫結束移除
    el.addEventListener("animationend", () => el.remove());
}
function ensureComboLayer() {
  const boardEl = document.getElementById("game-board");
  if (!boardEl) return;
  let layer = document.getElementById("combo-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "combo-layer";
    boardEl.appendChild(layer);
  }
}

function clearComboLayer() {
  const layer = document.getElementById("combo-layer");
  if (layer) layer.innerHTML = "";
}
function comboBlastFx(px, py, comboN) {
  comboN = Math.max(1, Number(comboN) || 1); 
  ensureComboLayer();
  ensureComboLayer();
  const layer = document.getElementById("combo-layer");
  if (!layer) return;

  // 1) 浮字（很亮但透明）
  const text = document.createElement("div");
  text.className = "combo-fx" + (comboN >= 3 ? " big" : "");
  text.textContent = `COMBO x${comboN}`;
  text.style.left = px + "px";
  text.style.top = py + "px";
  layer.appendChild(text);
  text.addEventListener("animationend", () => text.remove());

  // 連續兩次以上：加強特效（不擋畫面）
    if (comboN >= 2) {
    const boardEl = document.getElementById("game-board");
    if (boardEl) {
        boardEl.classList.remove("board-pulse"); // 讓連續觸發也會重新播放
        void boardEl.offsetWidth;                // reflow 觸發動畫重播（很輕量）
        boardEl.classList.add("board-pulse");
    }

    // Shockwave（大光圈）
    const shock = document.createElement("div");
    shock.className = "combo-shock" + (comboN >= 3 ? " big" : "");
    shock.style.left = px + "px";
    shock.style.top  = py + "px";
    layer.appendChild(shock);
    shock.addEventListener("animationend", () => shock.remove());
    }
  // 2) 霓虹圈（不遮擋，看起來很科技）
  const ring = document.createElement("div");
  ring.className = "combo-ring";
  ring.style.left = px + "px";
  ring.style.top  = py + "px";
  layer.appendChild(ring);
  ring.addEventListener("animationend", () => ring.remove());

  // 3) 粒子（少量即可很炫，不會卡）
  const particleCount = Math.min(24, 10 + comboN * 4);
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");
    p.className = "combo-particle";

    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * (50 + comboN * 10);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;

    p.style.left = px + "px";
    p.style.top  = py + "px";
    p.style.setProperty("--dx", dx.toFixed(1) + "px");
    p.style.setProperty("--dy", dy.toFixed(1) + "px");
    p.style.setProperty("--d", (0.55 + Math.random() * 0.25).toFixed(2) + "s");

    layer.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}