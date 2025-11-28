document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('current-score');
    const highScoreDisplay = document.getElementById('high-score');
    const highScorePlayerDisplay = document.getElementById('high-score-player');
    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMessage = document.getElementById('overlay-message');
    const startButton = document.getElementById('start-button');

    // --- 遊戲參數設定 ---
    const GRID_SIZE = 20; // 網格大小 (20x20 pixels)
    const TILE_COUNT = 20; // 網格總數 (20x20 tiles)
    canvas.width = TILE_COUNT * GRID_SIZE;
    canvas.height = TILE_COUNT * GRID_SIZE;
    let gameLoop;
    let inputDirection = { x: 0, y: 0 };
    let lastInputDirection = { x: 0, y: 0 };
    let speed = 8; // 遊戲速度 (每秒更新次數)
    let lastRenderTime = 0;
    let score = 0;
    let snake = [];
    let food = {};
    let isGameOver = false;

    // --- 遊戲邏輯函數 ---

    function setupGame() {
        // 重置遊戲狀態
        score = 0;
        isGameOver = false;
        scoreDisplay.textContent = score;
        inputDirection = { x: 1, y: 0 }; // 初始向右移動
        lastInputDirection = { x: 1, y: 0 };
        
        // 初始蛇身 (3個區塊)
        snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];

        placeFood();
        overlay.style.display = 'none';
    }

    // 隨機放置食物
    function placeFood() {
        let newFoodPosition;
        do {
            newFoodPosition = {
                x: Math.floor(Math.random() * TILE_COUNT),
                y: Math.floor(Math.random() * TILE_COUNT)
            };
        } while (onSnake(newFoodPosition)); // 確保食物不在蛇身上
        food = newFoodPosition;
    }

    // 檢查座標是否在蛇身上
    function onSnake(position, { ignoreHead = false } = {}) {
        return snake.some((segment, index) => {
            if (ignoreHead && index === 0) return false;
            return segment.x === position.x && segment.y === position.y;
        });
    }

    // 遊戲主循環
    function main(currentTime) {
        if (isGameOver) {
            // 遊戲結束時停止循環
            cancelAnimationFrame(gameLoop);
            return;
        }

        gameLoop = requestAnimationFrame(main);
        const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
        
        // 控制遊戲速度
        if (secondsSinceLastRender < 1 / speed) return;
        
        lastRenderTime = currentTime;

        update();
        draw();
    }

    // 更新遊戲狀態
    function update() {
        // 1. 處理方向鎖定
        lastInputDirection = inputDirection;

        // 2. 檢查是否吃到食物
        if (snake[0].x === food.x && snake[0].y === food.y) {
            // 增加長度 (不移除尾巴)
            snake.unshift({ x: food.x, y: food.y });
            score++;
            scoreDisplay.textContent = score;
            placeFood();
        } else {
            // 3. 移動蛇 (移除尾巴並在頭部新增區塊)
            const newHead = {
                x: snake[0].x + inputDirection.x,
                y: snake[0].y + inputDirection.y
            };
            snake.unshift(newHead); // 新增頭部
            snake.pop(); // 移除尾巴
        }

        // 4. 檢查遊戲結束條件
        checkDeath();
    }

    // 檢查死亡條件
    function checkDeath() {
        // 撞牆
        if (snake[0].x < 0 || snake[0].x >= TILE_COUNT ||
            snake[0].y < 0 || snake[0].y >= TILE_COUNT) {
            isGameOver = true;
        }
        // 撞到自己 (忽略頭部)
        if (onSnake(snake[0], { ignoreHead: true })) {
            isGameOver = true;
        }

        if (isGameOver) {
            handleGameOver();
        }
    }

    // 遊戲結束處理
    async function handleGameOver() {
        overlayTitle.textContent = "遊戲結束！";
        overlayMessage.innerHTML = `最終得分: ${score}<br>點擊「重新開始」`;
        startButton.textContent = "重新開始";
        overlay.style.display = 'block';

        // 提交分數到後端
        await submitScore(score);
        // 更新最高分顯示
        await fetchHighScore();
    }

    // 繪製遊戲畫面
    function draw() {
        // 清空畫布
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 繪製蛇
        ctx.fillStyle = '#27ae60'; // 綠色
        snake.forEach(segment => {
            ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
        });

        // 繪製食物
        ctx.fillStyle = '#e74c3c'; // 紅色
        ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
    }

    // --- 控制輸入處理 ---

    document.addEventListener('keydown', e => {
        let newDir = { x: inputDirection.x, y: inputDirection.y };

        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                if (lastInputDirection.y !== 1) newDir = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
            case 's':
                if (lastInputDirection.y !== -1) newDir = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
            case 'a':
                if (lastInputDirection.x !== 1) newDir = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
            case 'd':
                if (lastInputDirection.x !== -1) newDir = { x: 1, y: 0 };
                break;
        }
        inputDirection = newDir;
    });

    // --- 後端 API 互動 ---

    // 取得最高分
    async function fetchHighScore() {
        try {
            const response = await fetch('/api/highscore');
            const data = await response.json();
            highScoreDisplay.textContent = data.score;
            highScorePlayerDisplay.textContent = data.player;
        } catch (error) {
            console.error('Error fetching high score:', error);
            highScoreDisplay.textContent = 'N/A';
        }
    }

    // 提交分數
    async function submitScore(currentScore) {
        // 只有當分數大於0時才提交，並模擬從使用者介面獲取玩家名稱
        if (currentScore > 0) {
            const playerName = prompt("恭喜！請輸入您的名字以記錄分數：") || "匿名玩家";
            try {
                const response = await fetch('/api/submit_score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ score: currentScore, player: playerName })
                });
                const result = await response.json();
                if (result.new_high_score) {
                    alert(`🎊 新紀錄！${playerName} 的分數：${result.new_high_score}`);
                }
            } catch (error) {
                console.error('Error submitting score:', error);
            }
        }
    }

    // --- 遊戲初始化 ---
    
    // 1. 載入最高分
    fetchHighScore();

    // 2. 啟動按鈕
    startButton.addEventListener('click', () => {
        // 在按下開始後，執行 setupGame 並開始遊戲循環
        setupGame();
        main(0); // 傳入 0 讓遊戲立刻開始
    });

    // 初始繪製畫布和覆蓋層
    draw();
    overlay.style.display = 'block'; 
});