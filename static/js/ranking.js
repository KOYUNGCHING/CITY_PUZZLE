document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#ranking-table tbody');
    const loadingMsg = document.getElementById('loading-message');

    async function loadRanking() {
        try {
            const response = await fetch('/api/ranking');
            const data = await response.json();

            tableBody.innerHTML = ''; 
            loadingMsg.style.display = 'none';

            data.forEach((player) => {
                const tr = document.createElement('tr');
                // 這裡顯示總累計分數
                tr.innerHTML = `
                    <td>${player.rank}</td>
                    <td>${player.name}</td>
                    <td>${player.total_score}</td> 
                `;
                tableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Ranking Error:', error);
            loadingMsg.textContent = "無法載入排名資料";
        }
    }

    loadRanking();
});