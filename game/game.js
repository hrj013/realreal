
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
const cameraTargetOffset = 350;

const startY = 580;
const floorY = 750;
const floorHeight = 40;

// ========================================
// Streamlit 연동 및 플레이 기록
// ========================================

let runId = createRunId();
let gameStartTime = Date.now();
let resultSent = false;
let currentSkin = "basic";

function createRunId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2)
    );
}

function getPlayTime() {
    return Math.max(
        0,
        Math.round((Date.now() - gameStartTime) / 1000 * 10) / 10
    );
}

// ========================================
// Streamlit 결과 전송
// ========================================

function sendResultToStreamlit() {
    if (resultSent) return;

    resultSent = true;

    const result = {
        run_id: runId,
        score: Number(score) || 0,
        max_height: Number(maxHeight) || 0,
        play_time: getPlayTime(),
        skin: currentSkin,
        finished: true
    };

    window.parent.postMessage(
        {
            isStreamlitMessage: true,
            type: "streamlit:setComponentValue",
            value: result
        },
        "*"
    );
}

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
// 점수, 카메라, 난이도
// ========================================

let cameraY = 0;
let maxHeight = 0;
let score = 0;
let gameOver = false;

// 500점마다 난이도 상승
function getDifficulty() {
    return Math.min(5, Math.floor(maxHeight / 500));
}

function getDifficultyName() {
    const level = getDifficulty();

    if (level === 0) return "쉬움";
    if (level === 1) return "보통";
    if (level === 2) return "도전";
    if (level === 3) return "어려움";
    if (level === 4) return "매우 어려움";
    return "최고 난이도";
}

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
        width: 180, height: 20,
        level: 0
    });

    platforms.push({
        x: 300, y: 520,
        width: 160, height: 20,
        level: 0
    });

    platforms.push({
        x: 100, y: 410,
        width: 180, height: 20,
        level: 0
    });

    platforms.push({
        x: 420, y: 300,
        width: 170, height: 20,
        level: 0
    });

    platforms.push({
        x: 200, y: 190,
        width: 180, height: 20,
        level: 0
    });

    highestPlatformY = 190;
}

// ========================================
// 플랫폼 좌우 위치 생성
// ========================================

function getPlatformX(width, level) {
    const maxX = canvas.width - width;
    const previous = platforms[platforms.length - 1];

    if (!previous) {
        return Math.random() * maxX;
    }

    const previousCenter = previous.x + previous.width / 2;

    const minHorizontalGap = 35 + level * 15;
    const maxHorizontalGap = 280 + level * 15;

    let fallbackX = Math.random() * maxX;

    for (let i = 0; i < 80; i++) {
        const x = Math.random() * maxX;
        const center = x + width / 2;
        const distance = Math.abs(center - previousCenter);

        fallbackX = x;

        if (
            distance >= minHorizontalGap &&
            distance <= maxHorizontalGap
        ) {
            return x;
        }
    }

    return fallbackX;
}

// ========================================
// 위쪽 플랫폼 생성
// ========================================


function createNewPlatforms() {
    // 카메라 위쪽으로 충분한 발판을 계속 생성한다.
    const generateUntilY = cameraY - 1200;

    while (highestPlatformY > generateUntilY) {
        const level = getDifficulty();

        const gapMin = 90 + level * 5;
        const gapRange = Math.max(25, 55 - level * 3);
        const gapY = gapMin + Math.random() * gapRange;

        highestPlatformY -= gapY;

        const widthMax = Math.max(135, 190 - level * 10);
        const widthMin = Math.max(100, 125 - level * 5);

        const width =
            widthMin + Math.random() * (widthMax - widthMin);

        const x = getPlatformX(width, level);

        platforms.push({
            x: x,
            y: highestPlatformY,
            width: width,
            height: 20,
            level: level
        });
    }
}



function removeOldPlatforms() {
    // 화면 아래쪽으로 충분히 멀어진 발판만 제거한다.
    // 위쪽 발판을 지우면 앞으로 올라갈 발판이 사라질 수 있다.
    const removeBelowY = cameraY + canvas.height + 400;

    for (let i = platforms.length - 1; i >= 0; i--) {
        if (platforms[i].y > removeBelowY) {
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

    player.velocityX = (dx / distance) * power;
    player.velocityY = (dy / distance) * power;

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
// 충돌 판정
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

        const crossedTop =
            previousBottom <= top &&
            currentBottom >= top;

        // 플랫폼 윗면 착지
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

        // 플랫폼 밑면 충돌
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

        // 플랫폼 옆면 충돌
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

    // 바닥에 떨어지면 게임 오버
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

    // 화면 좌우 경계
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

    // 착지 후 미끄러짐 감소
    if (player.grounded) {
        player.velocityX *= groundFriction;
    } else {
        player.velocityX *= airFriction;
    }

    if (Math.abs(player.velocityX) < stopSpeed) {
        player.velocityX = 0;
    }

    // 최고 높이 기준 점수
    const currentHeight = Math.max(
        0,
        Math.floor(startY - player.y)
    );

    if (currentHeight > maxHeight) {
        maxHeight = currentHeight;
        score = maxHeight;

        const heightElement = document.getElementById("height");
        const scoreElement = document.getElementById("score");

        if (heightElement) {
            heightElement.textContent = maxHeight;
        }

        if (scoreElement) {
            scoreElement.textContent = score;
        }
    }

    // 카메라가 플레이어를 따라감
    const targetCameraY = player.y - cameraTargetOffset;

    cameraY +=
        (targetCameraY - cameraY) * cameraFollowSpeed;

    // 발판 생성 및 정리
    createNewPlatforms();
    removeOldPlatforms();

    // 난이도 표시
    const difficultyElement =
        document.getElementById("difficulty");

    if (difficultyElement) {
        difficultyElement.textContent = getDifficultyName();
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

        if (y < -100 || y > canvas.height + 100) {
            continue;
        }

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

        if (
            screenY < -50 ||
            screenY > canvas.height + 50
        ) {
            continue;
        }

        const level = platform.level || 0;

        if (level >= 4) {
            ctx.fillStyle = "#388e3c";
        } else if (level >= 2) {
            ctx.fillStyle = "#43a047";
        } else {
            ctx.fillStyle = "#4caf50";
        }

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
// 스킨별 플레이어 그리기
// ========================================

function drawPlayer() {
    const screenY = player.y - cameraY;

    let bodyColor = "#2e7d32";
    let footColor = "#1b5e20";

    switch (currentSkin) {
        case "leaf":
            bodyColor = "#66bb6a";
            footColor = "#2e7d32";
            break;

        case "ocean":
            bodyColor = "#29b6f6";
            footColor = "#0277bd";
            break;

        case "rainbow":
            bodyColor = "#ab47bc";
            footColor = "#7b1fa2";
            break;

        case "basic":
        default:
            bodyColor = "#2e7d32";
            footColor = "#1b5e20";
            break;
    }

    // 몸통
    ctx.fillStyle = bodyColor;
    ctx.fillRect(
        player.x,
        screenY,
        player.width,
        player.height
    );

    // 눈
    ctx.fillStyle = "white";
    ctx.fillRect(player.x + 7, screenY + 9, 5, 5);
    ctx.fillRect(player.x + 18, screenY + 9, 5, 5);

    // 발
    ctx.fillStyle = footColor;
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

    const finalHeight =
        document.getElementById("finalHeight");

    const finalScore =
        document.getElementById("finalScore");

    const gameOverElement =
        document.getElementById("gameOver");

    if (finalHeight) {
        finalHeight.textContent = maxHeight;
    }

    if (finalScore) {
        finalScore.textContent = score;
    }

    if (gameOverElement) {
        gameOverElement.style.display = "block";
    }

    sendResultToStreamlit();
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

    runId = createRunId();
    gameStartTime = Date.now();
    resultSent = false;

    createStartingPlatforms();

    const heightElement = document.getElementById("height");
    const scoreElement = document.getElementById("score");
    const gameOverElement = document.getElementById("gameOver");
    const difficultyElement = document.getElementById("difficulty");

    if (heightElement) heightElement.textContent = "0";
    if (scoreElement) scoreElement.textContent = "0";

    if (difficultyElement) {
        difficultyElement.textContent = getDifficultyName();
    }

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
// Streamlit 컴포넌트 초기화
// ========================================

window.addEventListener("message", function(event) {
    const message = event.data;

    if (!message || message.type !== "streamlit:render") {
        return;
    }

    const args = message.args || {};

    if (args.skin) {
        currentSkin = String(args.skin);
    }
});

window.parent.postMessage(
    {
        isStreamlitMessage: true,
        type: "streamlit:componentReady",
        apiVersion: 1
    },
    "*"
);

createStartingPlatforms();
gameLoop();
