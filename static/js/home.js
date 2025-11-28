document.addEventListener('DOMContentLoaded', () => {
    // 獲取所有按鈕元素
    const rankButton = document.getElementById('rank-button');
    const puzzleJumpButton = document.getElementById('puzzle-jump-button');
    const selectGameButton = document.getElementById('select-game-button');
    
    // 獲取玩家資訊元素 (可選：用於動態更新)
    const playerName = document.getElementById('player-name');
    const playerAvatar = document.querySelector('.avatar');
    const playerScore = document.getElementById('player-score');

    // 範例：加載動態數據
    function loadPlayerData() {
        // 在真實遊戲中，這裡會從伺服器或本地存儲加載數據
        const userData = {
            name: "勇敢的記者",
            score: 2450,
            avatarUrl: "new_avatar.png" // 替換為實際的頭貼圖片路徑
        };

        playerName.textContent = userData.name;
        playerScore.textContent = `總得分: ${userData.score}`;
        // playerAvatar.src = userData.avatarUrl; 
        
        console.log(`玩家 ${userData.name} 的數據已加載。`);
    }

    loadPlayerData();


    // --- 按鈕點擊事件監聽器 ---

    rankButton.addEventListener('click', () => {
        // TODO: 實作跳轉到積分排名頁面的邏輯
        alert('導航至：積分排名頁面');
        // window.location.href = 'ranking.html';
    });

    puzzleJumpButton.addEventListener('click', () => {
        // TODO: 實作跳轉到目前拼圖/挑戰頁面的邏輯
        alert('導航至：目前拼圖挑戰頁面');
        // window.location.href = 'current-puzzle.html';
    });

    selectGameButton.addEventListener('click', () => {
        // TODO: 實作跳轉到選擇遊戲模式頁面的邏輯
        alert('導航至：選擇遊戲模式頁面');
        // window.location.href = 'select-game.html';
    });

});