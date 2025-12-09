// static/js/game.js

document.addEventListener('DOMContentLoaded', () => {
    const gameCards = document.querySelectorAll('.game-card');
    
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            // 獲取 data-game-id 屬性值 (1, 2, 3, 4, or 5)
            const gameId = card.dataset.gameId;
            
            if (gameId) {
                // 跳轉到對應的 Flask 路由 /game/X
                window.location.href = `/game/${gameId}`;
            } else {
                console.error('Game ID not found on card.');
            }
        });
    });
});