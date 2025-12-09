let timerInterval;
let seconds = 0;
let solutionBoard = [];
let currentDifficulty = 'easy';
let mistakes = 0;
const MAX_MISTAKES = 3;
let activeNumber = null;

document.addEventListener("DOMContentLoaded", function() {
    startGame('easy');
});

function startGame(difficulty) {
    currentDifficulty = difficulty;
    clearInterval(timerInterval);
    seconds = 0;
    mistakes = 0;
    activeNumber = null;
    
    updateMistakeUI();
    document.getElementById('timer').innerText = "00:00";
    timerInterval = setInterval(updateTimer, 1000);

    // UI 更新
    document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = {'easy': 0, 'medium': 1, 'hard': 2};
    const btns = document.querySelectorAll('.diff-btn');
    if(btns[btnMap[difficulty]]) btns[btnMap[difficulty]].classList.add('active');

    // 重置鍵盤
    clearNumberPadSelection();
    document.getElementById('btn-eraser').classList.remove('active-pad');
    // 重置所有數字按鈕的 completed 狀態
    document.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('completed'));
    
    generateSudoku(difficulty);
}

function updateTimer() {
    seconds++;
    let m = Math.floor(seconds / 60).toString().padStart(2, '0');
    let s = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('timer').innerText = `${m}:${s}`;
}

function updateMistakeUI() {
    const el = document.getElementById('mistake-count');
    el.innerText = `${mistakes}/${MAX_MISTAKES}`;
    if(mistakes === 0) el.style.color = "#00ffcc";
    else if(mistakes === 1) el.style.color = "#ffff00";
    else el.style.color = "#ff0000";
}

// --- 數獨生成 (維持不變) ---
function generateSudoku(difficulty) {
    let board = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillDiagonal(board);
    solveSudoku(board);
    solutionBoard = JSON.parse(JSON.stringify(board));

    let removeCount = difficulty === 'easy' ? 20 : (difficulty === 'medium' ? 40 : 50);
    removeDigits(board, removeCount);
    renderBoard(board);
}

function fillDiagonal(board) { for (let i = 0; i < 9; i += 3) fillBox(board, i, i); }
function fillBox(board, row, col) {
    let num;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            do { num = Math.floor(Math.random() * 9) + 1; } 
            while (!isSafeInBox(board, row, col, num));
            board[row + i][col + j] = num;
        }
    }
}
function isSafeInBox(board, rowStart, colStart, num) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (board[rowStart + i][colStart + j] === num) return false;
    return true;
}
function isSafe(board, row, col, num) {
    for (let x = 0; x < 9; x++) if (board[row][x] === num) return false;
    for (let x = 0; x < 9; x++) if (board[x][col] === num) return false;
    let startRow = row - row % 3, startCol = col - col % 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (board[i + startRow][j + startCol] === num) return false;
    return true;
}
function solveSudoku(board) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] === 0) {
                for (let num = 1; num <= 9; num++) {
                    if (isSafe(board, row, col, num)) {
                        board[row][col] = num;
                        if (solveSudoku(board)) return true;
                        board[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}
function removeDigits(board, count) {
    while (count > 0) {
        let cellId = Math.floor(Math.random() * 81);
        let row = Math.floor(cellId / 9);
        let col = cellId % 9;
        if (board[row][col] !== 0) {
            board[row][col] = 0;
            count--;
        }
    }
}

// --- 介面渲染 ---
function renderBoard(board) {
    const container = document.getElementById('sudoku-board');
    container.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            let div = document.createElement('div');
            div.classList.add('cell');
            div.dataset.row = r;
            div.dataset.col = c;
            div.addEventListener('click', (e) => handleBoardClick(div));

            if (board[r][c] !== 0) {
                div.innerText = board[r][c];
                div.classList.add('fixed');
            }
            container.appendChild(div);
        }
    }
    // ★ 渲染完畢後，立即檢查有哪些數字已經滿 9 個了 (例如題目本身就滿的)
    updateNumberPadStatus();
}

// ★★★ 核心：檢查每個數字是否填滿 9 個 ★★★
function updateNumberPadStatus() {
    // 統計目前盤面上每個數字出現的次數 (只算 correct 的: fixed 和 locked)
    let counts = Array(10).fill(0); // index 1-9
    
    document.querySelectorAll('.cell').forEach(cell => {
        // 必須是題目(fixed) 或 答對的(locked) 才算數
        if (cell.classList.contains('fixed') || cell.classList.contains('locked')) {
            let val = parseInt(cell.innerText);
            if (!isNaN(val)) counts[val]++;
        }
    });

    // 更新按鈕狀態
    for (let i = 1; i <= 9; i++) {
        const btn = document.querySelectorAll('.num-btn')[i-1]; // 按鈕是 0-8 對應 1-9
        if (counts[i] >= 9) {
            btn.classList.add('completed'); // 變暗
            // 如果剛好這支筆是選中的，強制取消選取
            if (activeNumber === i) {
                activeNumber = null;
                btn.classList.remove('active-pad');
                clearHighlights();
            }
        } else {
            btn.classList.remove('completed');
        }
    }
}

// --- 點擊與互動 ---
function handleBoardClick(cell) {
    if (cell.classList.contains('fixed') || cell.classList.contains('locked')) {
        let val = parseInt(cell.innerText);
        if (activeNumber === 'eraser') return;
        highlightAllInstances(val);
        return; 
    }

    if (activeNumber === 'eraser') {
        fillCell(cell, null);
        return;
    }

    if (activeNumber !== null) {
        fillCell(cell, activeNumber);
        return; 
    }

    document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    
    let val = parseInt(cell.innerText);
    if (!isNaN(val)) highlightAllInstances(val);
    else clearHighlights();
}

function selectNumberPad(num) {
    document.getElementById('btn-eraser').classList.remove('active-pad');
    
    // 如果該數字已經完成，不能選
    const btnIndex = num - 1;
    const btns = document.querySelectorAll('.num-btn');
    if (num !== null && btns[btnIndex].classList.contains('completed')) {
        return; // 禁止選取已完成的數字
    }

    activeNumber = num;
    clearNumberPadSelection();
    
    if (num !== null) {
        btns[btnIndex].classList.add('active-pad'); 
        highlightAllInstances(num);
    } else {
        clearHighlights();
    }
}

function toggleEraser() {
    let selected = document.querySelector('.cell.selected');
    if (selected && !selected.classList.contains('fixed') && !selected.classList.contains('locked')) {
        fillCell(selected, null);
        return; 
    }

    if (activeNumber === 'eraser') {
        activeNumber = null;
        document.getElementById('btn-eraser').classList.remove('active-pad');
    } else {
        activeNumber = 'eraser';
        clearNumberPadSelection(); 
        clearHighlights();         
        document.getElementById('btn-eraser').classList.add('active-pad');
    }
}

function clearNumberPadSelection() {
    document.querySelectorAll('.num-btn:not(.clear-btn)').forEach(btn => btn.classList.remove('active-pad'));
}

function highlightAllInstances(num) {
    clearHighlights();
    if (!num) return;
    document.querySelectorAll('.cell').forEach(cell => {
        if (parseInt(cell.innerText) === num) cell.classList.add('highlight-same');
    });
}

function clearHighlights() {
    document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('highlight-same'));
}

// --- 填入與驗證 ---
function fillCell(cell, num) {
    if (num === null) {
        cell.innerText = '';
        cell.classList.remove('user-input', 'error');
        return;
    }

    cell.innerText = num;
    let r = parseInt(cell.dataset.row);
    let c = parseInt(cell.dataset.col);
    let correctNum = solutionBoard[r][c];

    if (num === correctNum) {
        cell.classList.remove('error', 'user-input');
        cell.classList.add('locked');
        
        // ★ 答對後，檢查該數字是否滿 9 個了 ★
        updateNumberPadStatus();
        
        checkWinCondition();
    } else {
        cell.classList.add('error');
        handleMistake();
    }
}

function handleMistake() {
    mistakes++;
    updateMistakeUI();
    if (mistakes >= MAX_MISTAKES) {
        gameOver();
    }
}

function gameOver() {
    clearInterval(timerInterval);
    document.querySelectorAll('.cell').forEach(c => c.style.pointerEvents = 'none');
    setTimeout(() => {
        alert("任務失敗！錯誤次數過多。\n(System Lockdown: Too many errors)");
        location.reload(); 
    }, 300);
}

document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (key >= '1' && key <= '9') selectNumberPad(parseInt(key));
    if (key === 'Backspace' || key === 'Delete') {
        let selected = document.querySelector('.cell.selected');
        if (selected && !selected.classList.contains('fixed') && !selected.classList.contains('locked')) {
            fillCell(selected, null);
        }
    }
});

async function checkWinCondition() {
    let unfinished = document.querySelector('.cell:not(.fixed):not(.locked)');
    if (!unfinished) {
        clearInterval(timerInterval);
        let fragments = (currentDifficulty === 'easy') ? 1 : (currentDifficulty === 'medium' ? 3 : 5);
        
        setTimeout(async () => {
            try {
                const response = await fetch('/api/game_complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        game: 'sudoku',
                        difficulty: currentDifficulty,
                        time_taken: seconds,
                        fragments: fragments
                    })
                });
                const result = await response.json();
                if(result.status === 'success') {
                    alert(`DECRYPTION SUCCESSFUL!\n獲得碎片: ${fragments}\n時間: ${seconds}秒`);
                }
            } catch (error) {
                alert(`【測試過關】\n\n難度: ${currentDifficulty.toUpperCase()}\n碎片: ${fragments}\n時間: ${seconds}秒`);
            }
        }, 300);
    }
}
// ====== 新增：回首頁按鈕 ======
document.getElementById("homeBtn").addEventListener("click", () => {
  // 如果你的首頁是 "/"
  window.location.href = "/game";
  // 若要導向其他頁，例如 "/index" 可改成：
  // window.location.href = "/index";
});