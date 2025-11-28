document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#ranking-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const homeButton = document.getElementById('home-button');

    // 回首頁按鈕的邏輯
    homeButton.addEventListener('click', () => {
        // 在真實專案中，這裡會是跳回首頁的 URL
        window.location.href = 'index.html'; 
    });

    // 取得排名數據並渲染到表格
    async function fetchAndRenderRanking() {
        // 假設後端 API 路徑是 /api/ranking
        const apiURL = '/api/ranking'; 
        
        // 清空現有表格內容
        tableBody.innerHTML = '';
        loadingMessage.style.display = 'block'; // 顯示載入中提示

        try {
            // 使用 Fetch API 獲取數據
            const response = await fetch(apiURL);
            
            // 檢查 HTTP 狀態碼
            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
            }

            const rankings = await response.json();

            // 隱藏載入中提示
            loadingMessage.style.display = 'none';

            // 渲染數據到表格
            rankings.forEach((player, index) => {
                const rank = index + 1;
                const row = tableBody.insertRow();
                
                // 插入名次、名稱、帳號、積分
                row.insertCell().textContent = rank;
                row.insertCell().textContent = player.name;
                row.insertCell().textContent = player.account;
                row.insertCell().textContent = player.score.toLocaleString(); // 格式化分數
            });
            
        } catch (error) {
            console.error('載入排名數據時發生錯誤:', error);
            loadingMessage.textContent = '載入數據失敗，請檢查伺服器連接。';
            // 如果連線失敗，可以使用一些假數據作為備用 (Demo Purpose)
            renderFallbackData(tableBody);
        }
    }

    // 備用假數據渲染函數 (當連線後端失敗時使用)
    function renderFallbackData(tbody) {
        tbody.innerHTML = ''; // 清空
        const fallbackData = [
            { name: "戰地記者W", account: "press_w", score: 12500 },
            { name: "鷹眼偵探", account: "eye007", score: 9800 },
            { name: "暗夜追蹤者", account: "dark_tracker", score: 8500 },
            { name: "真相守護者", account: "truth_guard", score: 7200 },
            { name: "獨家報導員", account: "exclusive_r", score: 5500 },
        ];

        fallbackData.forEach((player, index) => {
            const row = tbody.insertRow();
            row.insertCell().textContent = index + 1;
            row.insertCell().textContent = player.name;
            row.insertCell().textContent = player.account;
            row.insertCell().textContent = player.score.toLocaleString();
        });
        loadingMessage.style.display = 'none';
    }

    // 啟動頁面時載入排名
    // 如果您尚未運行 Flask 後端，請將 `fetchAndRenderRanking()` 替換為 `renderFallbackData(tableBody)` 進行測試
    fetchAndRenderRanking(); 
});