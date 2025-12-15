document.addEventListener("DOMContentLoaded", async function() {
    const username = localStorage.getItem("logged_in_username");
    
    // UI 元素
    const userInfoDisplay = document.getElementById("username-display");
    const fragDisplay = document.getElementById("current-fragments");
    const unlockBtn = document.getElementById("unlock-button");
    const costDisplay = document.getElementById("cost-display");
    const costSpan = document.getElementById("cost");
    const messageP = document.getElementById("message");

    // 檢查登入
    if (!username) { 
        alert("請先登入！");
        window.location.href = "/login"; 
        return; 
    }
    
    userInfoDisplay.textContent = username;

    // 1. 載入狀態主函式
    async function loadStatus() {
        try {
            const res = await fetch(`/api/puzzle_progress?username=${encodeURIComponent(username)}`);
            const data = await res.json();
            
            if (data.status === 'success') {
                // 更新錢包顯示
                if (fragDisplay) fragDisplay.textContent = data.current_fragments;
                
                // ★★★ 核心：只更新拼圖塊視覺，不進行底圖切換 ★★★
                updatePuzzleVisuals(data.progress_id);
                // checkProsperity(data.progress_id); // 移除此行
                
                // 更新按鈕狀態
                const cost = data.cost || 10;
                if (costDisplay) costDisplay.textContent = cost;
                if (costSpan) costSpan.textContent = cost;
                
                if (unlockBtn) {
                    if (data.progress_id >= 16) {
                        unlockBtn.disabled = true;
                        unlockBtn.textContent = "🎉 已全部完成";
                        unlockBtn.style.backgroundColor = "#555";
                    } else if (data.current_fragments < cost) {
                        unlockBtn.disabled = true;
                        unlockBtn.textContent = `碎片不足 (持有: ${data.current_fragments})`;
                        unlockBtn.style.backgroundColor = "#555";
                    } else {
                        unlockBtn.disabled = false;
                        unlockBtn.textContent = `點擊解鎖下一塊 (花費 ${cost} 碎片)`;
                        unlockBtn.style.backgroundColor = "#ffcc00"; 
                    }
                }
            }
        } catch (e) { 
            console.error(e); 
            if (messageP) messageP.textContent = "載入失敗";
        }
    }

    // 2. 解鎖按鈕 (保持不變)
    if (unlockBtn) {
        unlockBtn.addEventListener('click', async function() {
            try {
                const res = await fetch('/api/unlock_puzzle', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: username })
                });
                const result = await res.json();
                
                if (result.status === 'success') {
                    alert(result.message);
                    loadStatus(); // 成功後重新整理狀態
                } else {
                    alert(result.message);
                }
            } catch (e) {
                alert("連線錯誤");
            }
        });
    }

    // 3. 更新拼圖塊顯示 (保持不變，此函數實現了亮起 1/4 塊的效果)
    function updatePuzzleVisuals(unlockedCount) {
        const pieces = document.querySelectorAll('.puzzle-piece');
        pieces.forEach((piece, index) => {
            // 資料庫進度是 1~16
            let pid = piece.dataset.progressId ? parseInt(piece.dataset.progressId) : (index + 1);
            
            if (pid <= unlockedCount) {
                piece.classList.add('unlocked');
            } else {
                piece.classList.remove('unlocked');
            }
        });
    }
    // 4. ★★★ 檢查是否全解鎖並切換成繁榮圖 (Prosperity) ★★★
    function checkProsperity(progress) {
        // 定義每個地標的完成門檻與圖片 ID
        // 101: 1~4, Eiffel: 5~8, Liberty: 9~12, Pyramid: 13~16
        const landmarks = [
            { id: 'landmark-101', min: 4, img: '../static/img/Puzzles/101_prosperity.jpg' },
            { id: 'landmark-eiffel', min: 8, img: '../static/img/Puzzles/eiffel_prosperity.jpg' },
            { id: 'landmark-liberty', min: 12, img: '../static/img/Puzzles/liberty_prosperity.jpg' },
            { id: 'landmark-pyramid', min: 16, img: '../static/img/Puzzles/pyramid_prosperity.jpg' }
        ];

        landmarks.forEach(lm => {
            if (progress >= lm.min) {
                const container = document.getElementById(lm.id);
                if (container) {
                    const baseImg = container.querySelector('.base-image');
                    const overlay = container.querySelector('.pieces-overlay');
                    
                    // 切換底圖為繁榮版
                    if (baseImg) {
                        baseImg.src = lm.img;
                        baseImg.style.filter = "none"; // 移除原本的灰階濾鏡
                    }
                    
                    // 隱藏拼圖塊 (因為底圖已經變彩色了，不需要拼圖塊遮擋)
                    if (overlay) {
                        overlay.style.display = "none";
                    }
                }
            }
        });
    }

    // 啟動
    loadStatus();
});