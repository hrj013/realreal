
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 700;

// ========================================
// 게임 설정
// ========================================

const gravity = 0.5;
const maxJumpPower = 15;
const distancePower = 20;

// 공중과 발판 위의 마찰
const airFriction = 0.98;
const groundFriction = 0.70;

// 거의 멈춘 속도는 0으로 처리
const stopSpeed = 0.15;


// ========================================
// 플레이어
// ========================================

const player = {
    x: 100,
    y: 580,
    width: 30,
    height: 40,
    velocityX: 0,
    velocityY: 0,
    grounded: false
};


// ========================================
// 카메라와 점수
// ========================================

let cameraY = 0;
let maxHeight = 0;
let score = 0;
let gameOver = false;


// ========================================
// 마우스 조작
// ========================================

let dragging = false;
let mouseStartX = 0;
let mouseStartY = 0;
let mouseX = 0;
let mouseY = 0;


// ========================================
// 플랫폼
// ========================================

const platforms = [];
let highestPlatformY = 190;

function createStartingPlatforms() {
    platforms.length = 0;

    platforms.push({
        x: 50, y: 620,
        width: 180, height: 20
    });

    platforms.push({
        x: 300, y: 520,
        width: 160, height: 20
    });

    platforms.push({
        x: 100, y: 410,
        width: 180, height: 20
    });

    platforms.push({
        x: 420, y: 300,
        width: 170, height: 20
    });

    platforms.push({
        x: 200, y: 190,
        width: 180, height: 20
    });

    highestPlatformY = 190;
}


// ========================================
// 무한 플랫폼 생성
// ========================================

function createNewPlatforms() {
    while (highestPlatformY > cameraY - 1000) {
        const gapY = 90 + Math.random() * 50;
        highestPlatformY -= gapY;

        const width = 120 + Math.random() * 90;
        const x = Math.random() * (canvas.width - width);

        platforms.push({
            x,
            y: highestPlatformY,
            width,
            height: 20
        });
    }
}


function removeOldPlatforms() {
    for (let i = platforms.length - 1; i >= 0; i--) {
        if (platforms[i].y > cameraY + 900) {
            platforms.splice(i, 1);
        }
    }
}


// ========================================
// 점프
// ========================================

function jump(targetX, targetY) {
    if (!player.grounded || gameOver) return;

    const dx = targetX - mouseStartX;
    const dy = targetY - mouseStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) return;

    const power = Math.min(
        distance / distancePower,
        maxJumpPower
    );

    player.velocityX = dx / distance * power;
    player.velocityY = dy / distance * power;

    player.grounded = false;
}


// ========================================
// 마우스 이벤트
// ========================================

canvas.addEventListener("mousedown", function(event) {
    if (gameOver) return;

    dragging = true;

    const rect = canvas.getBoundingClientRect();

    mouseStartX = (event.clientX - rect.left) * canvas.width / rect.width;
    mouseStartY = (event.clientY - rect.top) * canvas.height / rect.height;

    mouseX = mouseStartX;
    mouseY = mouseStartY;
});

canvas.addEventListener("mousemove", function(event) {
    if (!dragging) return;

    const rect = canvas.getBoundingClientRect();

    mouseX = (event.clientX - rect.left) * canvas.width / rect.width;
    mouseY = (event.clientY - rect.top) * canvas.height / rect.height;
});

canvas.addEventListener("mouseup", function() {
    if (!dragging) return;

    dragging = false;
    jump(mouseX, mouseY);
});

canvas.addEventListener("mouseleave", function() {
    if (!dragging) return;

    dragging = false;
    jump(mouseX, mouseY);
});


// ========================================
// 정확한 플랫폼 충돌
// ========================================

function checkPlatformCollision(previousY) {
    player.grounded = false;

    const previousBottom = previousY + player.height;
    const currentBottom = player.y + player.height;

    for (const platform of platforms) {
        const left = platform.x;
        const right = platform.x + platform.width;
        const top = platform.y;
        const bottom = platform.y + platform.height;

        const playerLeft = player.x;
        const playerRight = player.x + player.width;
        const playerTop = player.y;
        const playerBottom = player.y + player.height;

        // 위에서 내려오며 착지:
        // 좌우 여유 범위 없이 실제 발판과 겹쳐야 함.
        const horizontalOverlap =
            playerRight > left &&
            playerLeft < right;

        const crossedTop =
            previousBottom <= top &&
            currentBottom >= top;

        if (
            player.velocityY >= 0 &&
            horizontalOverlap &&
            crossedTop
        ) {
            player.y = top - player.height;
            player.velocityY = 0;
            player.grounded = true;
            continue;
        }

        // 아래에서 발판 밑면에 부딪힘
        const horizontalOverlapNow =
            playerRight > left &&
            playerLeft < right;

        if (
            player.velocityY < 0 &&
            horizontalOverlapNow &&
            playerTop < bottom &&
            playerBottom > bottom
        ) {
            player.y = bottom;
            player.velocityY = 0;
            continue;
        }

        // 옆면 충돌: 실제 발판의 사각형 범위만 사용
        const verticalOverlap =
            playerBottom > top &&
            playerTop < bottom;

        if (!verticalOverlap) continue;

        if (
            player.velocityX > 0 &&
            playerRight > left &&
            playerLeft < left
        ) {
            player.x = left - player.width;
            player.velocityX = 0;
        } else if (
            player.velocityX < 0 &&
            playerLeft < right &&
            playerRight > right
        ) {
            player.x = right;
            player.velocityX = 0;
        }
    }
}


// ========================================
// 플레이어 업데이트
// ========================================

function updatePlayer() {
    if (gameOver) return;

    const previousY = player.y;

    // 중력과 이동
    player.velocityY += gravity;
    player.x += player.velocityX;
    player.y += player.velocityY;

    // 화면 좌우 경계
    if (player.x < 0) {
        player.x = 0;
        player.velocityX = 0;
    }

    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
        player.velocityX = 0;
    }

    // 플랫폼 충돌
    checkPlatformCollision(previousY);

    // 착지한 뒤에는 마찰을 크게 적용
    if (player.grounded) {
        player.velocityX *= groundFriction;
    } else {
        player.velocityX *= airFriction;
    }

    if (Math.abs(player.velocityX) < stopSpeed) {
        player.velocityX = 0;
    }

    // 최고 높이에 따라 점수 계산
    const currentHeight = Math.max(
        0,
        Math.floor(580 - player.y)
    );

    if (currentHeight > maxHeight) {
        maxHeight = currentHeight;
        score = maxHeight;

        document.getElementById("height").textContent = maxHeight;
        document.getElementById("score").textContent = score;
    }

    // 카메라는 위로만 이동
    const targetCameraY = player.y - 300;

    if (targetCameraY < cameraY) {
        cameraY = targetCameraY;
    }

    createNewPlatforms();
    removeOldPlatforms();

    // 화면 아래로 떨어지면 게임 종료
    if (player.y > cameraY + 900) {
        endGame();
    }
}


// ========================================
// 배경
// ========================================

function drawBackground() {
    ctx.fillStyle = "#bde0fe";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}


// ========================================
// 구름
// ========================================

function drawClouds() {
    const clouds = [
        { x: 100, y: 100 },
        { x: 600, y: 250 },
        { x: 350, y: 450 },
        { x: 50, y: 700 }
    ];

    for (const cloud of clouds) {
        const y = cloud.y - cameraY * 0.3;

        if (y < -100 || y > canvas.height + 100) continue;

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(cloud.x, y, 25, 0, Math.PI * 2);
        ctx.arc(cloud.x + 30, y - 10, 30, 0, Math.PI * 2);
        ctx.arc(cloud.x + 60, y, 25, 0, Math.PI * 2);
        ctx.fill();
    }
}


// ========================================
// 플랫폼 그리기
// ========================================

function drawPlatforms() {
    for (const platform of platforms) {
        const screenY = platform.y - cameraY;

        if (screenY < -50 || screenY > canvas.height + 50) continue;

        ctx.fillStyle = "#4caf50";
        ctx.fillRect(
            platform.x,
            screenY,
            platform.width,
            platform.height
        );

        ctx.fillStyle = "#81c784";
        ctx.fillRect(
            platform.x,
            screenY,
            platform.width,
            5
        );
    }
}


// ========================================
// 플레이어 그리기
// ========================================

function drawPlayer() {
    const screenY = player.y - cameraY;

    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(
        player.x,
        screenY,
        player.width,
        player.height
    );

    ctx.fillStyle = "white";
    ctx.fillRect(player.x + 7, screenY + 9, 5, 5);
    ctx.fillRect(player.x + 18, screenY + 9, 5, 5);

    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(player.x + 2, screenY + 35, 10, 5);
    ctx.fillRect(player.x + 18, screenY + 35, 10, 5);
}


// ========================================
// 점프 조준선
// ========================================

function drawAim() {
    if (!dragging || gameOver) return;

    ctx.strokeStyle = "rgba(46,125,50,0.6)";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(
        player.x + player.width / 2,
        player.y - cameraY + player.height / 2
    );
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();

    ctx.fillStyle = "#2e7d32";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
    ctx.fill();
}


// ========================================
// 게임 오버
// ========================================

function endGame() {
    gameOver = true;

    document.getElementById("finalHeight").textContent = maxHeight;
    document.getElementById("finalScore").textContent = score;
    document.getElementById("gameOver").style.display = "block";
}


// ========================================
// 다시 시작
// ========================================

function restartGame() {
    player.x = 100;
    player.y = 580;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;

    cameraY = 0;
    maxHeight = 0;
    score = 0;
    gameOver = false;
    dragging = false;

    createStartingPlatforms();
    createNewPlatforms();

    document.getElementById("height").textContent = "0";
    document.getElementById("score").textContent = "0";
    document.getElementById("gameOver").style.display = "none";
}


// ========================================
// 게임 루프
// ========================================

function gameLoop() {
    updatePlayer();

    drawBackground();
    drawClouds();
    drawPlatforms();
    drawPlayer();
    drawAim();

    requestAnimationFrame(gameLoop);
}


// ========================================
// 게임 시작
// ========================================

createStartingPlatforms();
createNewPlatforms();
gameLoop();
