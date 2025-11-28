document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素獲取 ---
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
    const GRID_SIZE = 20; // 網格大小 (像素)
    // 🚨 修正: 預留更多空間 (從 80 增加到 200)，縮小遊戲區域
    const WINDOW_PADDING_BUFFER = 200; 
    
    let TILE_COUNT_WIDTH = 20;
    let TILE_COUNT_HEIGHT = 20;

    // 遊戲狀態變數
    let gameLoop;
    let inputDirection = { x: 0, y: 0 }; 
    let lastInputDirection = { x: 0, y: 0 }; 
    let speed = 6; // 遊戲速度 🚨 初始速度
    const MAX_SPEED = 15; // 遊戲速度上限
    const SPEED_INCREMENT = 0.5; // 每次加速的幅度
    const SPEED_SCORE_INTERVAL = 3; // 每 3 分加速一次
    let lastRenderTime = 0;
    let score = 0;
    let snake = [];
    let food = {};
    let isGameOver = false;

    // --- 地圖擴張相關變數 ---
    let mapBoundary = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let walls = []; // 儲存隨機生成的牆面座標
    
    const EXPAND_STEP = 5; 
    const WALL_SPAWN_INTERVAL = 3; 
    let lastWallScore = 0; 
    
    const EXPAND_INTERVAL = 5; 
    let lastExpandScore = 0;

    // --- 本地最高分存儲 (取代 Flask 後端) ---
    let localHighScore = {
        score: parseInt(localStorage.getItem('snakeHighScore') || '0', 10),
        player: localStorage.getItem('snakeHighPlayer') || 'N/A'
    };
    
    // --- 🚨 修正：Canvas 背景圖載入與檔名 ---
    const gameBackgroundTexture = new Image();
    // 修正路徑: 圖片位於 static/picture/game3p1.jpg
    gameBackgroundTexture.src = '../picture/game3p1.jpg'; 
    let isTextureLoaded = false;

    gameBackgroundTexture.onload = () => {
        isTextureLoaded = true;
        // 載入完成後重新繪圖
        if (!isGameOver) { 
            draw();
        }
    };
    gameBackgroundTexture.onerror = () => {
        // 更新警告訊息
        console.warn("無法載入遊戲背景圖片 (../picture/game3p1.jpg)。請確認檔名和路徑是否正確。將使用純色背景。"); 
        isTextureLoaded = true; 
        draw();
    };


    // --- 🚨 核心修正 1: 處理視窗大小調整和響應式佈局 ---

    function calculateInitialSize() {
        // 根據視窗當前大小重新計算網格數
        // 這裡使用增加後的 PADDING_BUFFER
        TILE_COUNT_WIDTH = Math.max(20, Math.floor((window.innerWidth - WINDOW_PADDING_BUFFER) / GRID_SIZE));
        TILE_COUNT_HEIGHT = Math.max(20, Math.floor((window.innerHeight - WINDOW_PADDING_BUFFER) / GRID_SIZE));
        
        // 如果遊戲還沒開始，或者地圖已經比初始大小大，則不做縮小操作
        if (mapBoundary.maxX === 0 || mapBoundary.maxX < TILE_COUNT_WIDTH - 1) {
             // 只有在初始化時或手動重置時才設定初始大小
            mapBoundary.maxX = TILE_COUNT_WIDTH - 1;
            mapBoundary.maxY = TILE_COUNT_HEIGHT - 1;
        }

        canvas.width = (mapBoundary.maxX - mapBoundary.minX + 1) * GRID_SIZE;
        canvas.height = (mapBoundary.maxY - mapBoundary.minY + 1) * GRID_SIZE;
        
        // 如果遊戲已經開始，只需要重繪
        if (!isGameOver) {
             draw();
        }
    }

    // 啟動時和視窗大小改變時都調用
    calculateInitialSize();
    window.addEventListener('resize', calculateInitialSize);


    // --- 遊戲初始化與重置 ---

    function setupGame() {
        // 重置遊戲狀態
        score = 0;
        isGameOver = false;
        scoreDisplay.textContent = score;
        inputDirection = { x: 1, y: 0 }; 
        lastInputDirection = { x: 1, y: 0 };
        walls = []; // 清空牆面
        speed = 10; // 重置速度為初始值
        
        // 重置地圖邊界為初始狀態 (使用當前計算的視窗大小)
        mapBoundary = {
            minX: 0, 
            minY: 0, 
            maxX: TILE_COUNT_WIDTH - 1, 
            maxY: TILE_COUNT_HEIGHT - 1 
        };
        // 畫布恢復初始大小
        canvas.width = TILE_COUNT_WIDTH * GRID_SIZE;
        canvas.height = TILE_COUNT_HEIGHT * GRID_SIZE;

        // 初始蛇身 (在初始地圖中央)
        const centerX = Math.floor(TILE_COUNT_WIDTH / 2); 
        const centerY = Math.floor(TILE_COUNT_HEIGHT / 2); 
        snake = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY }
        ];

        placeFood();
        overlay.style.display = 'none';
        lastWallScore = 0;
        lastExpandScore = 0;
    }

    // --- 食物與蛇身檢查 (邏輯不變) ---

    function placeFood() {
        let newFoodPosition;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            newFoodPosition = {
                x: Math.floor(Math.random() * (mapBoundary.maxX - mapBoundary.minX + 1)) + mapBoundary.minX,
                y: Math.floor(Math.random() * (mapBoundary.maxY - mapBoundary.minY + 1)) + mapBoundary.minY
            };
            attempts++;
        } while ((onSnake(newFoodPosition) || onWall(newFoodPosition)) && attempts < maxAttempts); 
        
        if (attempts >= maxAttempts) {
             console.warn("無法找到放置食物的位置！");
             isGameOver = true;
        }
        
        food = newFoodPosition;
    }

    function onSnake(position, { ignoreHead = false } = {}) {
        return snake.some((segment, index) => {
            if (ignoreHead && index === 0) return false;
            return segment.x === position.x && segment.y === position.y;
        });
    }
    
    function onWall(position) {
        return walls.some(wall => wall.x === position.x && wall.y === position.y);
    }


    // --- 遊戲主循環與更新 ---

    function main(currentTime) {
        if (isGameOver) {
            cancelAnimationFrame(gameLoop);
            return;
        }

        gameLoop = requestAnimationFrame(main);
        const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
        
        if (secondsSinceLastRender < 1 / speed) return;
        
        lastRenderTime = currentTime;

        update();
        draw();
    }

    // 🚨 修正：新增速度提升邏輯
    function checkSpeedIncrease() {
        if (score > 0 && 
            score % SPEED_SCORE_INTERVAL === 0 && 
            speed < MAX_SPEED && 
            scoreDisplay.textContent != score) { // 確保只在分數真正改變時觸發
            
            speed = Math.min(MAX_SPEED, speed + SPEED_INCREMENT);
            console.log("Speed increased to:", speed.toFixed(1));
        }
    }


    function update() {
        lastInputDirection = inputDirection;
        
        const nextHead = {
            x: snake[0].x + inputDirection.x,
            y: snake[0].y + inputDirection.y
        };
        
        let foodEaten = false;

        if (nextHead.x === food.x && nextHead.y === food.y) {
            foodEaten = true;
            score++;
            scoreDisplay.textContent = score;
            
            // 🚨 檢查是否需要加速
            checkSpeedIncrease();

            if (score > 0 && score % EXPAND_INTERVAL === 0 && score !== lastExpandScore) {
                const directions = ['left', 'right', 'up', 'down'];
                const randomDirection = directions[Math.floor(Math.random() * directions.length)];
                expandMap(randomDirection);
                lastExpandScore = score;
            }

            if (score > 0 && score % WALL_SPAWN_INTERVAL === 0 && score !== lastWallScore) {
                spawnWalls(); 
                lastWallScore = score;
            }
        } 
        
        snake.unshift(nextHead); 
        
        if (!foodEaten) {
            snake.pop(); 
        } else {
            placeFood();
        }

        checkDeath();
    }


    // --- 地圖擴張與牆面生成邏輯 (邏輯不變) ---

    function expandMap(direction) {
        let newTiles = EXPAND_STEP;
        let offsetX = 0;
        let offsetY = 0;

        if (direction === 'left') {
            mapBoundary.minX -= newTiles;
            offsetX = newTiles; 
        } else if (direction === 'right') {
            mapBoundary.maxX += newTiles;
        } else if (direction === 'up') {
            mapBoundary.minY -= newTiles;
            offsetY = newTiles; 
        } else if (direction === 'down') {
            mapBoundary.maxY += newTiles;
        }
        
        snake.forEach(segment => {
            segment.x += offsetX;
            segment.y += offsetY;
        });
        food.x += offsetX;
        food.y += offsetY;
        walls.forEach(wall => {
            wall.x += offsetX;
            wall.y += offsetY;
        });
        
        const totalWidth = mapBoundary.maxX - mapBoundary.minX + 1;
        const totalHeight = mapBoundary.maxY - mapBoundary.minY + 1;
        canvas.width = totalWidth * GRID_SIZE;
        canvas.height = totalHeight * GRID_SIZE;
        
        console.log(`地圖擴張！方向: ${direction}, 新尺寸: ${totalWidth}x${totalHeight}`);
    }
    
    function spawnWalls() {
        const SEGMENT_COUNT = Math.floor(Math.random() * 3) + 3;
        
        for (let i = 0; i < SEGMENT_COUNT; i++) {
            const segmentLength = Math.floor(Math.random() * 3) + 2; 
            const isHorizontal = Math.random() < 0.5; 
            
            let startPos;
            let attempts = 0;
            const maxAttempts = 100;
            
            do {
                startPos = {
                    x: Math.floor(Math.random() * (mapBoundary.maxX - mapBoundary.minX + 1)) + mapBoundary.minX,
                    y: Math.floor(Math.random() * (mapBoundary.maxY - mapBoundary.minY + 1)) + mapBoundary.minY
                };
                attempts++;
            } while ((onSnake(startPos) || onWall(startPos) || (startPos.x === food.x && startPos.y === food.y)) && attempts < maxAttempts);
            
            if (attempts >= maxAttempts) continue; 

            for (let j = 0; j < segmentLength; j++) {
                let currentWall = {
                    x: startPos.x + (isHorizontal ? j : 0),
                    y: startPos.y + (isHorizontal ? 0 : j)
                };
                
                if (currentWall.x < mapBoundary.minX || currentWall.x > mapBoundary.maxX ||
                    currentWall.y < mapBoundary.minY || currentWall.y > mapBoundary.maxY) {
                    break; 
                }

                if (onSnake(currentWall) || (currentWall.x === food.x && currentWall.y === food.y)) {
                    continue; 
                }

                if (!onWall(currentWall)) {
                    walls.push(currentWall);
                }
            }
        }
    }


    // --- 遊戲結束條件檢查 (邏輯不變) ---

    function checkDeath() {
        const head = snake[0];
        
        // 死亡條件 1: 撞到邊界
        if (head.x < mapBoundary.minX || 
            head.x > mapBoundary.maxX ||
            head.y < mapBoundary.minY || 
            head.y > mapBoundary.maxY) {
            isGameOver = true;
        }

        // 死亡條件 2: 撞到牆面阻礙
        if (onWall(head)) {
            isGameOver = true;
        }

        // 死亡條件 3: 撞到自己 (忽略蛇頭本身)
        if (onSnake(head, { ignoreHead: true })) {
            isGameOver = true;
        }

        if (isGameOver) {
            handleGameOver();
        }
    }

    // 遊戲結束處理 (邏輯不變)
    async function handleGameOver() {
        overlayTitle.textContent = "遊戲結束！";
        overlayMessage.innerHTML = `最終得分: ${score}<br>點擊「重新開始」`;
        startButton.textContent = "重新開始";
        overlay.style.display = 'block';

        submitScore(score); 
        fetchHighScore();
    }


    // --- 繪圖邏輯 (🚨 修正：使用圖片作為畫布背景) ---

    function draw() {
        // 清空畫布
        if (isTextureLoaded && gameBackgroundTexture.complete) {
             // 修正：使用圖片作為背景 (平鋪模式)
            try {
                const pattern = ctx.createPattern(gameBackgroundTexture, 'repeat');
                ctx.fillStyle = pattern;
            } catch(e) {
                // 處理 createPattern 失敗時的回退
                ctx.fillStyle = '#3d3533'; 
            }
        } else {
            // 如果圖片還沒載入或載入失敗，使用純色背景 (災難色)
            ctx.fillStyle = '#3d3533'; 
        }
        
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 定義圓角函數
        function drawRoundedRect(x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.arcTo(x + width, y, x + width, y + radius, radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
            ctx.lineTo(x + radius, y + height);
            ctx.arcTo(x, y + height, x, y + height - radius, radius);
            ctx.lineTo(x, y + radius);
            ctx.arcTo(x, y, x + radius, y, radius);
            ctx.closePath();
            ctx.fill();
        }

        // 🚨 繪製火焰 (Food) 的函數
        function drawFire(x, y, size) {
            // 繪製多層次圓形來模擬火焰的閃爍感
            const cx = x + size / 2;
            const cy = y + size / 2;

            // 外層火焰 (橙紅)
            ctx.fillStyle = '#ff6347'; // Tomato Red
            ctx.beginPath();
            ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
            ctx.fill();

            // 中層火焰 (橙黃)
            ctx.fillStyle = '#ffa500'; // Orange
            ctx.beginPath();
            ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
            ctx.fill();

            // 內核火焰 (亮黃)
            ctx.fillStyle = '#ffd700'; // Gold
            ctx.beginPath();
            ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }


        // 蛇身和物件的間隔與圓角設定
        const ITEM_PADDING = 2; // 方塊之間的間隔
        const ITEM_SIZE = GRID_SIZE - ITEM_PADDING * 2; // 實際繪製方塊大小
        const CORNER_RADIUS = 5; // 圓角半徑，可以調整

        // 繪製牆面 (廢墟/障礙物)
        ctx.fillStyle = '#7f8c8d'; // 較深的灰色/石色
        walls.forEach(wall => {
            const drawX = (wall.x - mapBoundary.minX) * GRID_SIZE + ITEM_PADDING;
            const drawY = (wall.y - mapBoundary.minY) * GRID_SIZE + ITEM_PADDING;
            drawRoundedRect(drawX, drawY, ITEM_SIZE, ITEM_SIZE, CORNER_RADIUS);
        });

        // 繪製水管 (Snake)
        ctx.fillStyle = '#4a90e2'; // 水藍色
        snake.forEach((segment, index) => {
            const drawX = (segment.x - mapBoundary.minX) * GRID_SIZE + ITEM_PADDING;
            const drawY = (segment.y - mapBoundary.minY) * GRID_SIZE + ITEM_PADDING;
            
            // 🚨 水管頭部 (水槍口)
            if (index === 0) {
                // 蛇頭使用更鮮豔的藍色，模擬水壓/噴嘴
                ctx.fillStyle = '#3498db'; 
                // 畫一個小圓點模擬噴水孔
                ctx.beginPath();
                ctx.arc(drawX + ITEM_SIZE/2, drawY + ITEM_SIZE/2, ITEM_SIZE/2 - 1, 0, Math.PI * 2);
                ctx.fill();
                
                // 水管連接處
                ctx.fillStyle = '#4a90e2';
                drawRoundedRect(drawX + ITEM_SIZE*0.1, drawY + ITEM_SIZE*0.1, ITEM_SIZE*0.8, ITEM_SIZE*0.8, CORNER_RADIUS);

            } else {
                ctx.fillStyle = '#4a90e2'; // 水管顏色
                drawRoundedRect(drawX, drawY, ITEM_SIZE, ITEM_SIZE, CORNER_RADIUS);
            }
        });

        // 繪製火焰 (Food)
        const fireDrawX = (food.x - mapBoundary.minX) * GRID_SIZE + ITEM_PADDING;
        const fireDrawY = (food.y - mapBoundary.minY) * GRID_SIZE + ITEM_PADDING;
        drawFire(fireDrawX - ITEM_PADDING, fireDrawY - ITEM_PADDING, GRID_SIZE);

        // 繪製邊界 (保持不變)
        ctx.strokeStyle = '#e67e22'; 
        ctx.lineWidth = GRID_SIZE / 5;
        ctx.strokeRect(
            ctx.lineWidth / 2, 
            ctx.lineWidth / 2, 
            canvas.width - ctx.lineWidth, 
            canvas.height - ctx.lineWidth
        );
    }


    // --- 控制輸入處理 (邏輯不變) ---

    document.addEventListener('keydown', e => {
        let newDir = { x: inputDirection.x, y: inputDirection.y };
        switch (e.key) {
            case 'ArrowUp': case 'w': if (lastInputDirection.y !== 1) newDir = { x: 0, y: -1 }; break;
            case 'ArrowDown': case 's': if (lastInputDirection.y !== -1) newDir = { x: 0, y: 1 }; break;
            case 'ArrowLeft': case 'a': if (lastInputDirection.x !== 1) newDir = { x: -1, y: 0 }; break;
            case 'ArrowRight': case 'd': if (lastInputDirection.x !== -1) newDir = { x: 1, y: 0 }; break;
        }
        inputDirection = newDir;
    });


    // --- 本地數據互動 (邏輯不變) ---

    function fetchHighScore() {
        highScoreDisplay.textContent = localHighScore.score;
        highScorePlayerDisplay.textContent = localHighScore.player;
    }

    function submitScore(currentScore) {
        if (currentScore > localHighScore.score) {
            const playerName = prompt("恭喜！您打破了紀錄！請輸入您的名字：") || "匿名玩家";
            
            localHighScore.score = currentScore;
            localHighScore.player = playerName;

            localStorage.setItem('snakeHighScore', currentScore);
            localStorage.setItem('snakeHighPlayer', playerName);
            
            alert(`🎊 新紀錄！${playerName} 的分數：${currentScore}`);
        } else if (currentScore > 0) {
             console.log(`分數 ${currentScore} 沒有打破紀錄 (${localHighScore.score})。`);
        }
    }


    // --- 遊戲啟動 ---
    
    // 1. 載入最高分 (本地)
    fetchHighScore();

    // 2. 啟動按鈕
    startButton.addEventListener('click', () => {
        setupGame();
        main(0);
    });

    draw();
    overlay.style.display = 'block'; 
});