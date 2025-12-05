// 每個拼圖塊所需的小拼圖數 (與後端 PIECE_COST 匹配)
const PIECE_COST = 5; 

document.addEventListener('DOMContentLoaded', () => {
    // 獲取當前登入的使用者名稱
    const username = localStorage.getItem('username'); 
    
    if (!username) {
        alert("請先登入！");
        window.location.href = '/login'; 
        return;
    }

    // 渲染函數 (與前一輪回答相同，用於顯示拼圖進度)
    const renderPuzzles = async () => {
        try {
            const response = await fetch(`/api/puzzle_progress/${username}`);
            if (!response.ok) {
                throw new Error('Failed to fetch puzzle progress');
            }
            const progressData = await response.json();
            
            const landmarkGroups = document.querySelectorAll('.landmark-group');
            let unlockedLandmarksCount = 0;

            landmarkGroups.forEach(group => {
                const landmarkKey = group.dataset.landmark;
                const progress = progressData[landmarkKey];
                const piecesContainer = group.querySelector('.puzzle-pieces-container');
                piecesContainer.innerHTML = '';

                let piecesCompleted = 0;
                
                for (let i = 1; i <= 4; i++) {
                    const pieceCollected = progress[`piece_${i}`];
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('puzzle-piece');
                    pieceElement.dataset.piece = i;
                    
                    let statusClass = 'locked';
                    if (pieceCollected === PIECE_COST) {
                        statusClass = 'complete';
                        piecesCompleted++;
                    } else if (pieceCollected > 0) {
                        statusClass = 'collecting';
                    }
                    
                    pieceElement.classList.add(statusClass);
                    
                    pieceElement.textContent = `${pieceCollected} / ${PIECE_COST}`;
                    
                    piecesContainer.appendChild(pieceElement);
                }

                if (piecesCompleted === 4) {
                    group.classList.add('unlocked');
                    unlockedLandmarksCount++;
                } else {
                    group.classList.remove('unlocked');
                }
            });
            
        } catch (error) {
            console.error("渲染拼圖頁面失敗:", error);
        }
    };

    renderPuzzles();

    // 🎯 返回首頁邏輯 (指向 /home 路由)
    const backHomeButton = document.getElementById('back-home-button');
    if (backHomeButton) {
        backHomeButton.addEventListener('click', () => {
            window.location.href = '/home'; 
        });
    }
});