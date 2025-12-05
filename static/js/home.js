document.addEventListener('DOMContentLoaded', () => {
    // === 獲取所有按鈕元素 ===
    const rankButton = document.getElementById('rank-button');
    const puzzleJumpButton = document.getElementById('puzzle-jump-button');
    const selectGameButton = document.getElementById('select-game-button');

    // === 獲取玩家資訊元素 ===
    const playerName = document.getElementById('player-name');
    const playerAvatar = document.querySelector('.avatar');
    const playerScore = document.getElementById('player-score');

    // === 範例：載入動態玩家資料 ===
    function loadPlayerData() {
        // 將來你可以改成用 Flask session 或 fetch("/api/player")
        const userData = {
            name: "勇敢的記者",
            score: 2450,
            avatarUrl: "new_avatar.png"
        };

        playerName.textContent = userData.name;
        playerScore.textContent = `總得分: ${userData.score}`;
        // playerAvatar.src = userData.avatarUrl;

        console.log(`玩家 ${userData.name} 的數據已加載。`);
    }

    loadPlayerData();

    // === 按鈕功能 ===

    // 1. 積分排名
    rankButton.addEventListener('click', () => {
        // 如果用 Flask，改成 /rank
        window.location.href = "/rank";
        // 或純 HTML → window.location.href = "ranking.html";
    });

    // 2. 回到目前挑戰
    puzzleJumpButton.addEventListener('click', () => {
        // 如果用 Flask → /current-puzzle
        window.location.href = "/current-puzzle";
        // 純 HTML → "current_puzzle.html";
    });

    // 3. 選擇遊戲（你的需求）
    selectGameButton.addEventListener('click', () => {
        // Flask 版
        window.location.href = "/select-game";

        // 如果你是純 HTML（沒有 Flask）
        // window.location.href = "select_game.html";
    });
});