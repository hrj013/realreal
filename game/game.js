
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

const startY = 580;

// 맨 아래 고정 바닥
const floorY = 750;
const floorHeight = 40;

// 발판 좌우 간격 설정
const minHorizontalGap = 35;

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
// 새 발판의 좌우 위치 정하기
// ========================================

function getPlatformX(width) {
    const maxX = canvas.width - width;
    const previous = platforms[platforms.length - 1];

    // 첫 발판이거나 비교할 발판이 없을 때
    if (!previous) {
        return Math.random() * maxX;
    }

    const previousCenter = previous.x + previous.width / 2;

    // 이전 발판과 중심 위치가 너무 비슷하지 않도록
    // 가능한 위치를 여러 번 선택
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * maxX;
        const center = x + width / 2;

        if (Math.abs(center - previousCenter) >= minHorizontalGap) {
            return x;
        }
    }

    // 적절한 위치를 찾지 못하면 반대쪽으로 조금 이동
    let x = Math.random() * maxX;

    if (x + width / 2 < previousCenter) {
        x = Math.max(0, previousCenter - width / 2 - minHorizontalGap);
    } else {
        x = Math.min(maxX, previousCenter - width / 2 + minHorizontalGap);
    }

    return Math.max(0, Math.min(maxX, x));
}

// ========================================
// 위쪽에 무한 플랫폼 생성
// ========================================

function createNewPlatforms() {
    while (highestPlatformY > cameraY - 1000) {
        const gapY = 90 + Math.random() * 50;
        highestPlatformY -= gapY;

        // 기존보다 발판 너비 범위를 살짝 줄임
        const width = 120 + Math.random() * 70;
        const x = getPlatformX(width);

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
        if (platforms[i].y < cameraY - 1100) {
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

        // 발판 윗면 착지
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

        // 발판 밑면 충돌
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

    // 맨 아래 바닥에 떨어지면 게임 오버
    const playerBottom = player.y + player.height;

    if (
        player.velocityY >= 0 &&
        previousBottom <= floorY &&
        playerBottom >= floorY
    ) {
        endGame();
    }
}

// ========================================
// 플레이어 업데이트
// ========================================

function updatePlayer() {
    if (gameOver) return;

    const previousY = player.y;

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

    checkPlatformCollision(previousY);

    if (gameOver) return;

    // 발판 위에서 미끄러지는 속도 줄이기
    if (player.grounded) {
        player.velocityX *= groundFriction;
    } else {
        player.velocityX *= airFriction;
    }

    if (Math.abs(player.velocityX) < stopSpeed) {
        player.velocityX = 0;
    }

    // 최고 높이 점수
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

    // 카메라가 위아래로 캐릭터를 따라감
    const targetCameraY = player.y - cameraTargetOffset;

    cameraY +=
        (targetCameraY - cameraY) * cameraFollowSpeed;

    // 위쪽 발판만 계속 생성
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
