/* puzzle_select.js (位於 static/js/) */

const FRAGMENT_COST = 1000; 

document.addEventListener('DOMContentLoaded', () => {
    // 設置碎片成本顯示
    document.getElementById('cost').textContent = FRAGMENT_COST;
    document.getElementById('cost-display').textContent = FRAGMENT_COST;

    // 獲取登入的帳號 (從 localStorage 獲取)
    const username = localStorage.getItem('logged_in_username') || 'test_user'; 
    document.getElementById('username-display').textContent = username;
    
    if (username) {
        fetchProgress(username);
        // 初始化拼圖塊的背景位置
        initializePiecePositions();
    } else {
        alert("請先登入！");
        window.location.href = '/login'; 
    }
});

/**
 * 根據 data-position 屬性設置每個拼圖塊的 background-position
 */
function initializePiecePositions() {
    const pieces = document.querySelectorAll('.puzzle-piece');
    pieces.forEach(piece => {
        const position = piece.dataset.position;
        if (position) {
            piece.style.backgroundPosition = position;
        }
    });
}

/**
 * 從後端獲取當前玩家的進度 progress_id 和碎片數
 */
function fetchProgress(username) {
    fetch(`/api/puzzle_progress?username=${username}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const currentProgressId = data.progress_id;
                const fragments = data.current_fragments;
                
                document.getElementById('current-fragments').textContent = fragments;
                updatePuzzleDisplay(currentProgressId, fragments);
            } else {
                console.error('獲取進度失敗:', data.message);
                document.getElementById('message').textContent = '無法獲取進度。';
            }
        })
        .catch(error => console.error('Error fetching progress:', error));
}

/**
 * 根據 progress_id 來解鎖拼圖並更新按鈕狀態
 */
function updatePuzzleDisplay(progressId, fragments) {
    const pieces = document.querySelectorAll('.puzzle-piece');
    let totalUnlocked = 0;
    const maxProgress = 16;
    const unlockButton = document.getElementById('unlock-button');

    pieces.forEach(piece => {
        const requiredId = parseInt(piece.dataset.progressId, 10);
        
        if (progressId >= requiredId) {
            piece.classList.add('unlocked');
            totalUnlocked++;
        } else {
            piece.classList.remove('unlocked');
        }
    });

    // 更新按鈕和訊息
    if (totalUnlocked >= maxProgress) {
        unlockButton.disabled = true;
        unlockButton.textContent = "所有拼圖已完成！";
        document.getElementById('message').textContent = "恭喜您完成所有城市記憶拼圖！";
    } else if (fragments < FRAGMENT_COST) {
        unlockButton.disabled = true;
        document.getElementById('message').textContent = `碎片不足，還差 ${FRAGMENT_COST - fragments} 碎片才能解鎖下一塊。`;
        unlockButton.textContent = `碎片不足 (需要 ${FRAGMENT_COST})`;
    } else {
        unlockButton.disabled = false;
        unlockButton.textContent = `解鎖下一塊拼圖 (消費 ${FRAGMENT_COST} 碎片)`;
        document.getElementById('message').textContent = `您目前可解鎖下一塊拼圖 (第 ${progressId + 1} 塊)。`;
    }
}

/**
 * 處理解鎖按鈕點擊事件，發送請求到後端
 */
function unlockNextPiece() {
    const username = localStorage.getItem('logged_in_username') || 'test_user';
    const unlockButton = document.getElementById('unlock-button');
    unlockButton.disabled = true; 

    fetch('/api/unlock_puzzle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('message').textContent = data.message;
            fetchProgress(username);
        } else {
            document.getElementById('message').textContent = `解鎖失敗: ${data.message}`;
            fetchProgress(username);
        }
    })
    .catch(error => {
        console.error('Error during unlock:', error);
        document.getElementById('message').textContent = '連線錯誤，請稍後再試。';
    });
}