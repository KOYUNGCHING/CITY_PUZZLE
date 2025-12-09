document.addEventListener('DOMContentLoaded', () => {
    // === 獲取所有按鈕元素 ===
    const rankButton = document.getElementById('rank-button');
    const puzzleJumpButton = document.getElementById('puzzle-jump-button');
    const selectGameButton = document.getElementById('select-game-button');
    // 新增: 登出按鈕
    const logoutButton = document.getElementById('logout-button'); 

    // === 獲取玩家資訊元素 ===
    const playerName = document.getElementById('player-name');
    const playerAvatar = document.querySelector('.avatar');
    const playerScore = document.getElementById('player-score');

    // === 載入動態玩家資料 ===
    function loadPlayerData() {
        // 這裡應該從 localStorage 或 API 獲取登入數據
        const username = localStorage.getItem('logged_in_username') || '哈哈';
        // 我們從 localStorage 獲取分數 (如果存在的話)
        const fragments = localStorage.getItem('logged_in_fragments') || '0'; 

        playerName.textContent = username;
        playerScore.textContent = `總得分: ${fragments}`; 
        
        // 這裡可以加入頭像圖片的載入邏輯
        // const avatarId = localStorage.getItem('logged_in_avatar_id') || 1;
        // if (playerAvatar) {
        //     playerAvatar.src = `/static/img/avatars/avatar_${avatarId}.png`;
        // }

        console.log(`玩家 ${username} 的數據已加載。`);
    }

    // 載入玩家資料
    loadPlayerData();

    // =======================================================
    // === 按鈕功能 (整合所有路由和登出邏輯) ===
    // =======================================================

    // 1. 積分排名按鈕 (跳轉到 /ranking)
    if (rankButton) {
        rankButton.addEventListener('click', () => {
            window.location.href = "/ranking"; 
        });
    }

    // 2. ALL PUZZLES 按鈕 (跳轉到 /puzzle)
    if (puzzleJumpButton) {
        puzzleJumpButton.addEventListener('click', () => {
            window.location.href = "/puzzle"; 
        });
    }

    // 3. 選擇遊戲按鈕 (跳轉到 /game)
    if (selectGameButton) {
        selectGameButton.addEventListener('click', () => {
            window.location.href = "/game"; 
        });
    }
    
    // 4. 登出功能 (跳轉到 /login 並清除狀態)
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // 清除本地儲存的登入狀態
            localStorage.removeItem('logged_in_username');
            localStorage.removeItem('logged_in_fragments');
            localStorage.removeItem('logged_in_avatar_id');
            
            // 跳轉到登入頁面
            window.location.href = "/login";
        });
    }
});