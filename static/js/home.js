document.addEventListener('DOMContentLoaded', () => {
    // === 獲取所有按鈕元素 ===
    const rankButton = document.getElementById('rank-button');
    const puzzleJumpButton = document.getElementById('puzzle-jump-button');
    const selectGameButton = document.getElementById('select-game-button');

    // === 獲取玩家資訊元素 ===
    const playerName = document.getElementById('player-name');
    const playerAvatar = document.querySelector('.avatar');
    const playerScore = document.getElementById('player-score');

    // === 載入動態玩家資料 (您已有的邏輯) ===
    function loadPlayerData() {
        // 這裡應該從 localStorage 或 API 獲取登入數據
        const username = localStorage.getItem('logged_in_username') || '勇敢的記者';
        // 我們從 localStorage 獲取分數 (如果存在的話)
        const fragments = localStorage.getItem('logged_in_fragments') || '0'; 

        playerName.textContent = username;
        // 根據您首頁圖上的 "總得分: 2450"，這裡使用碎片數作為分數顯示
        playerScore.textContent = `總得分: ${fragments}`; 
        
        // 假設頭像圖片的路徑是 /static/img/avatars/avatar_[ID].png
        // const avatarId = localStorage.getItem('logged_in_avatar_id') || 1;
        // playerAvatar.src = `/static/img/avatars/avatar_${avatarId}.png`;

        console.log(`玩家 ${username} 的數據已加載。`);
    }

    // 載入玩家資料
    loadPlayerData();

    // =======================================================
    // === 按鈕功能 (已根據 Flask 路由 /ranking, /puzzle, /game 修正) ===
    // =======================================================

    // 1. 積分排名按鈕
    if (rankButton) {
        rankButton.addEventListener('click', () => {
            // 路由應為 /ranking (與 app.py 的 @app.route("/ranking") 對應)
            window.location.href = "/ranking"; 
        });
    }


    // 2. ALL PUZZLES 按鈕 (新需求: 跳轉到拼圖收集頁面)
    if (puzzleJumpButton) {
        puzzleJumpButton.addEventListener('click', () => {
            // 路由應為 /puzzle (與 app.py 的 @app.route("/puzzle") 對應)
            window.location.href = "/puzzle"; 
        });
    }


    // 3. 選擇遊戲按鈕
    if (selectGameButton) {
        selectGameButton.addEventListener('click', () => {
            // 路由應為 /game (與 app.py 的 @app.route("/game") 對應)
            window.location.href = "/game"; 
        });
    }
});