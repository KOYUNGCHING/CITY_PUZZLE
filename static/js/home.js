document.addEventListener('DOMContentLoaded', () => {
    const playerNameEl = document.getElementById('player-name');
    const playerScoreEl = document.getElementById('player-score');
    
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
            
            if (data.status === 'success') {
                playerNameEl.textContent = username;
                // ★ 這裡一定要對應 app.py 的 total_fragments
                playerScoreEl.textContent = `總積分: ${data.total_fragments}`;
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