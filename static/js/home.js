document.addEventListener('DOMContentLoaded', () => {
    // 1. 抓取文字元素
    const playerNameEl = document.getElementById('player-name');
    const playerScoreEl = document.getElementById('player-score');
    
    // ★ 修改處 1：這裡使用 getElementById 抓取您剛設定的 ID
    const playerAvatarEl = document.getElementById('player-avatar'); 

    // 按鈕
    const rankBtn = document.getElementById('rank-button');
    const puzzleBtn = document.getElementById('puzzle-jump-button');
    const gameBtn = document.getElementById('select-game-button');
    const logoutBtn = document.getElementById('logout-button');

    async function loadData() {
        const username = localStorage.getItem('logged_in_username');
        if (!username) {
            // 未登入狀態
            playerNameEl.textContent = "Guest";
            playerScoreEl.textContent = "請先登入";
            return;
        }

        try {
            const res = await fetch(`/api/puzzle_progress?username=${encodeURIComponent(username)}`);
            const data = await res.json();
            
            // ★ 建議加入這行 console.log，按 F12 看 Console 能確認後端有沒有傳 avatar_id 給你
            console.log("後端回傳資料:", data); 

            if (data.status === 'success') {
                playerNameEl.textContent = username;
                playerScoreEl.textContent = `總積分: ${data.total_fragments}`;

                // ★ 修改處 2：如果有抓到元素 且 後端有回傳 ID，就更新圖片
                if (playerAvatarEl && data.avatar_id) {
                    playerAvatarEl.src = `../static/img/Photo_stickers/Press${data.avatar_id}.png`;
                }

            } else {
                playerNameEl.textContent = username;
                playerScoreEl.textContent = "讀取失敗";
            }
        } catch (e) {
            console.error(e);
            playerNameEl.textContent = username;
        }
    }

    loadData();

    // ... (下方按鈕邏輯保持不變) ...
    if(rankBtn) rankBtn.onclick = () => window.location.href = "/ranking";
    if(puzzleBtn) puzzleBtn.onclick = () => window.location.href = "/puzzle";
    if(gameBtn) gameBtn.onclick = () => window.location.href = "/game";
    
    if(logoutBtn) logoutBtn.onclick = () => {
        if(confirm("確定要登出嗎？")) {
            localStorage.clear();
            window.location.href = "/login";
        }
    };
});