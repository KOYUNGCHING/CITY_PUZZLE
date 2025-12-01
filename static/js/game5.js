// script.js

// --- 初始化設定 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 遊戲參數
const groundHeight = 50;
const gravity = 0.6;
let initialGameSpeed = 5;
let gameSpeed = initialGameSpeed;

// 遊戲狀態
let gameOver = false;
let score = 0;
let frame = 0;
const obstacles = [];

// 火柴人物件
const player = {
    x: 50,
    y: canvas.height - groundHeight - 40,
    width: 20,
    height: 40,
    vy: 0,
    isJumping: false
};

// --- 事件處理器 ---
document.addEventListener('keydown', handleJump);

function handleJump(event) {
    // 按下空格鍵 (Code 'Space') 且不在跳躍中
    if (event.code === 'Space' && !player.isJumping && !gameOver) {
        player.isJumping = true;
        player.vy = -12; // 賦予向上速度
    }
}

// --- 繪圖函數 ---

// 繪製跑酷地面 (廢墟地面)
function drawGround() {
    ctx.fillStyle = '#4a4a4a'; // 深灰色/泥土色
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
}

// 繪製火柴人 (簡化)
function drawPlayer() {
    ctx.fillStyle = 'white'; // 火柴人使用白色在暗色背景中更醒目
    
    // 頭 (方塊)
    ctx.fillRect(player.x + 5, player.y - 10, 10, 10);
    // 身體 (方塊)
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// 繪製所有障礙物
function drawObstacles() {
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        
        // 增強視覺效果
        if (obs.type === 'alien') {
            // 外星人追兵：繪製一對紅色的眼睛
            ctx.fillStyle = 'red';
            ctx.fillRect(obs.x + 5, obs.y + 5, 5, 5);
            ctx.fillRect(obs.x + obs.width - 10, obs.y + 5, 5, 5);
        } else if (obs.type === 'meteor') {
            // 隕石：繪製火焰尾巴 (簡化)
            ctx.fillStyle = 'yellow';
            ctx.fillRect(obs.x + obs.width, obs.y + obs.height / 2 - 2, 8, 4);
        }
    });
}

// --- 更新函數 ---

function updatePlayer() {
    // 應用重力
    player.vy += gravity;
    player.y += player.vy;

    // 檢查是否落地
    const groundLevel = canvas.height - groundHeight - player.height;
    if (player.y >= groundLevel) {
        player.y = groundLevel;
        player.vy = 0;
        player.isJumping = false;
    }
}

function generateObstacle() {
    const type = Math.floor(Math.random() * 3);
    let newObstacle;

    if (type === 0) {
        // 1. 倒塌的廢墟 (地面障礙物)
        const h = 30 + Math.random() * 40;
        newObstacle = {
            x: canvas.width,
            y: canvas.height - groundHeight - h,
            width: 30,
            height: h,
            color: '#6e6e6e', // 廢墟灰色
            type: 'ruin'
        };
    } else if (type === 1) {
        // 2. 外星人追兵 (地面追擊，比火柴人高一點)
        newObstacle = {
            x: canvas.width,
            y: canvas.height - groundHeight - 50, 
            width: 40,
            height: 50,
            color: '#00cc66', // 外星人綠色
            type: 'alien'
        };
    } else {
        // 3. 隕石墜落 (空中/高位障礙物，需要跳過或從下方穿過)
        newObstacle = {
            x: canvas.width,
            y: canvas.height - groundHeight - 150 - Math.random() * 50, // 更高的位置
            width: 25,
            height: 25,
            color: '#ff8c00', // 隕石橙色
            type: 'meteor'
        };
    }

    obstacles.push(newObstacle);
}

function updateObstacles() {
    // 增加難度：隨著分數增加，遊戲速度加快
    gameSpeed = initialGameSpeed + Math.floor(score / 5) * 0.5;
    
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        
        // 障礙物向左移動
        obs.x -= gameSpeed;

        // 移除移出畫面左側的障礙物
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            i--;
            score++;
        }
    }

    // 障礙物生成計時
    frame++;
    // 調整生成頻率 (讓遊戲開始不會馬上很難)
    const generationRate = Math.max(70, 150 - Math.floor(score / 10) * 10); 

    if (frame > 50 && frame % generationRate === 0) {
        generateObstacle();
    }
}

// --- 碰撞檢測 ---

function checkCollision() {
    for (const obs of obstacles) {
        // 矩形碰撞檢測
        const playerRight = player.x + player.width;
        const playerBottom = player.y + player.height;
        const obsRight = obs.x + obs.width;
        const obsBottom = obs.y + obs.height;

        // 檢查 x 軸重疊 AND y 軸重疊
        if (playerRight > obs.x &&
            player.x < obsRight &&
            playerBottom > obs.y &&
            player.y < obsBottom) {
            
            // 發生碰撞，遊戲結束
            gameOver = true;
            return;
        }
    }
}

// --- 遊戲主迴圈 ---

function gameLoop() {
    if (gameOver) {
        // 遊戲結束畫面
        ctx.fillStyle = 'white';
        ctx.font = '36px "Arial Black"';
        ctx.textAlign = 'center';
        ctx.fillText('👽 遊戲結束！ 💥', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.font = '24px Arial';
        ctx.fillText('最終得分: ' + score, canvas.width / 2, canvas.height / 2 + 20);

        ctx.font = '16px Arial';
        ctx.fillText('按 F5 重新開始 (或刷新頁面)', canvas.width / 2, canvas.height / 2 + 60);
        return; 
    }

    // 1. 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. 更新遊戲狀態
    updatePlayer();
    updateObstacles();
    checkCollision(); 

    // 3. 繪製所有元素
    drawGround();
    drawObstacles();
    drawPlayer();

    // 4. 繪製分數
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('分數: ' + score, 10, 30);
    ctx.fillText('速度: ' + gameSpeed.toFixed(1), 10, 55);
    
    // 5. 請求下一次動畫幀
    requestAnimationFrame(gameLoop);
}

// 啟動遊戲
gameLoop();