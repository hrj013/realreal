
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

const airFriction = 0.98;
const groundFriction = 0.70;
const stopSpeed = 0.15;

const cameraFollowSpeed = 0.12;
const cameraTargetOffset = 300;

// 게임 시작 위치
const startY = 580;

// 맨 아래 고정 바닥
const floorY = 750;
const floorHeight = 40;

// ========================================
// 플레이어
// ========================================

const player = {
    x: 100,
    y: startY,
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
// 위쪽에 무한 플랫폼 생성
// ========================================

function createNewPlatforms() {
    while (highestPlatformY > cameraY - 1000) {
        const gapY = 90 + Math.random() * 50;
        highestPlatformY -= gapY;

        const width = 120 + Math.random() * 90;
        const x = Math.random() * (canvas.width - width);

        platforms.push({
            x: x,
            y: highestPlatformY,
            width: width,
            height: 20
        });
    }
}

function removeOldPlatforms() {
    for (let i = platforms.length - 1; i >= 0; i--) {
        // 바닥보다 아래에 있는 발판은 제거하지 않음
        if (platforms[i].y > cameraY + canvas.height + 700) {
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

    mouseStartX =
        (event.clientX - rect.left) * canvas.width / rect.width;

    mouseStartY =
        (event.clientY - rect.top) * canvas.height / rect.height;

    mouseX = mouseStartX;
    mouseY = mouseStartY;
});

canvas.addEventListener("mousemove", function(event) {
    if (!dragging) return;

    const rect = canvas.getBoundingClientRect();

    mouseX =
        (event.clientX - rect.left) * canvas.width / rect.width;

    mouseY =
        (event.clientY - rect.top) * canvas.height / rect.height;
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
// 발판 및 바닥 충돌
// ========================================

function checkPlatformCollision(previousY) {
    player.grounded = false;

    const previousBottom = previousY + player.height;
    const currentBottom = player.y + player.height;

    // 일반 발판 충돌
    for (const platform of platforms) {
        const left = platform.x;
        const right = platform.x + platform.width;
        const top = platform.y;
        const bottom = platform.y + platform.height;

        const playerLeft = player.x;
        const playerRight = player.x + player.width;
        const playerTop = player.y;
        const playerBottom = player.y + player.height;

        const horizontalOverlap =
            playerRight > left &&
            playerLeft < right;

        const crossedTop =
            previousBottom <= top &&
            currentBottom >= top;

        // 발판 위에서 착지
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

        // 발판 밑면에 충돌
        if (
            player.velocityY < 0 &&
            horizontalOverlap &&
            playerTop < bottom &&
            playerBottom > bottom
        ) {
            player.y = bottom;
            player.velocityY = 0;
            continue;
        }

        // 발판 옆면 충돌
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

    // 맨 아래 고정 바닥
    const playerLeft = player.x;
    const playerRight = player.x + player.width;
    const playerBottom = player.y + player.height;

    if (
        player.velocityY >= 0 &&
        previousBottom <= floorY &&
        playerBottom >= floorY
    ) {
        // 바닥에 닿으면 게임 오버
        endGame();
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

    // 좌우 화면 경계
    if (player.x < 0) {
        player.x = 0;
        player.velocityX = 0;
    }

    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
        player.velocityX = 0;
    }

    // 발판 충돌 및 바닥 게임 오버 확인
    checkPlatformCollision(previousY);

    if (gameOver) return;

    // 마찰
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
        Math.floor(startY - player.y)
    );

    if (currentHeight > maxHeight) {
        maxHeight = currentHeight;
        score = maxHeight;

        const heightElement = document.getElementById("height");
        const scoreElement = document.getElementById("score");

        if (heightElement) heightElement.textContent = maxHeight;
        if (scoreElement) scoreElement.textContent = score;
    }

    // 카메라가 위아래로 부드럽게 따라감
    const targetCameraY = player.y - cameraTargetOffset;

    cameraY +=
        (targetCameraY - cameraY) * cameraFollowSpeed;

    // 위쪽 발판만 무한 생성
    createNewPlatforms();
    removeOldPlatforms();
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

        if (screenY < -50 || screenY > canvas.height + 50) {
            continue;
        }

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
// 바닥 그리기
// ========================================

function drawFloor() {
    const screenY = floorY - cameraY;

    // 바닥이 화면에 보일 때만 그림
    if (
        screenY < canvas.height &&
        screenY + floorHeight > 0
    ) {
        ctx.fillStyle = "#795548";
        ctx.fillRect(
            0,
            screenY,
            canvas.width,
            floorHeight
        );

        ctx.fillStyle = "#4caf50";
        ctx.fillRect(
            0,
            screenY,
            canvas.width,
            10
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
    if (gameOver) return;

    gameOver = true;
    dragging = false;

    const finalHeight = document.getElementById("finalHeight");
    const finalScore = document.getElementById("finalScore");
    const gameOverElement = document.getElementById("gameOver");

    if (finalHeight) finalHeight.textContent = maxHeight;
    if (finalScore) finalScore.textContent = score;

    if (gameOverElement) {
        gameOverElement.style.display = "block";
    }
}

// ========================================
// 다시 시작
// ========================================

function restartGame() {
    player.x = 100;
    player.y = startY;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = false;

    cameraY = 0;
    maxHeight = 0;
    score = 0;
    gameOver = false;
    dragging = false;

    createStartingPlatforms();

    const heightElement = document.getElementById("height");
    const scoreElement = document.getElementById("score");
    const gameOverElement = document.getElementById("gameOver");

    if (heightElement) heightElement.textContent = "0";
    if (scoreElement) scoreElement.textContent = "0";

    if (gameOverElement) {
        gameOverElement.style.display = "none";
    }
}

// ========================================
// 게임 루프
// ========================================

function gameLoop() {
    updatePlayer();

    drawBackground();
    drawClouds();
    drawPlatforms();
    drawFloor();
    drawPlayer();
    drawAim();

    requestAnimationFrame(gameLoop);
}

// ========================================
// 게임 시작
// ========================================

createStartingPlatforms();
gameLoop();
