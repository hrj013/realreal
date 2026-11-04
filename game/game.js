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

// 캐릭터 기본 크기
const BASE_PLAYER_WIDTH = 30;
const BASE_PLAYER_HEIGHT = 40;

// 물약 중첩 한도 (너무 커지면 게임이 깨지므로 제한)
const MAX_JUMP_MULTIPLIER = 8;
const MAX_SIZE_MULTIPLIER = 8;

// ========================================
// 물약 정보
// ========================================

const POTION_LABELS = {
    revive: "❤️ 부활",
    score_2x: "✨ 점수x2",
    score_3x: "💎 점수x3",
    jump_2x: "🚀 점프x2",
    size_2x: "🧪 크기x2"
};

// 화면 아래 물약 바에 표시되는 순서
const POTION_BAR_ORDER = [
    "revive",
    "score_2x",
    "score_3x",
    "jump_2x",
    "size_2x"
];

// 키보드 단축키 (1~4)
const POTION_KEYS = {
    "1": "score_2x",
    "2": "score_3x",
    "3": "jump_2x",
    "4": "size_2x"
};

// 보유 수량 (Streamlit에서 처음 한 번만 받아오고, 이후에는 여기서 차감)
const potionInventory = {
    revive: 0,
    score_2x: 0,
    score_3x: 0,
    jump_2x: 0,
    size_2x: 0
};

let inventoryInitialized = false;

// 이번 게임에서 사용한 물약 기록 (Streamlit이 DB에서 차감할 때 사용)
let potionUses = [];

// 이번 게임의 물약 효과
let scoreMultiplier = 1;
let jumpMultiplier = 1;
let sizeMultiplier = 1;

// 게임 오버 후 부활 여부를 고르는 중인지
let awaitingRevive = false;

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
// Streamlit 값 전송
// ========================================
// 항상 "이번 게임의 전체 상태"를 보낸다.
// 물약 사용 기록(uses)은 누적 목록이라서,
// 값이 연속으로 전송되어 일부가 덮어써져도 기록이 유실되지 않는다.

function buildState(finished) {
    return {
        run_id: runId,
        score: Number(score) || 0,
        max_height: Number(maxHeight) || 0,
        play_time: getPlayTime(),
        skin: currentSkin,
        finished: finished,
        uses: potionUses.slice()
    };
}

function postStateToStreamlit(finished) {
    window.parent.postMessage(
        {
            isStreamlitMessage: true,
            type: "streamlit:setComponentValue",
            value: buildState(finished),
            dataType: "json"
        },
        "*"
    );
}

function sendResultToStreamlit() {
    if (resultSent) return;

    resultSent = true;
    postStateToStreamlit(true);
}

// ========================================
// 플레이어
// ========================================

const player = {
    x: 100,
    y: startY,
    width: BASE_PLAYER_WIDTH,
    height: BASE_PLAYER_HEIGHT,
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

// 점수 = 최고 높이 x 점수 배수
function refreshScore() {
    score = Math.floor(maxHeight * scoreMultiplier);

    const scoreElement = document.getElementById("score");

    if (scoreElement) {
        scoreElement.textContent = score;
    }
}

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

function getCanvasPos(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
    };
}

function pointInRect(x, y, rect) {
    return (
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
    );
}

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

    // 점프 높이 물약:
    // 점프 높이는 속도의 제곱에 비례하므로,
    // 높이를 N배로 만들려면 위쪽 속도에 √N을 곱한다.
    if (player.velocityY < 0 && jumpMultiplier > 1) {
        player.velocityY *= Math.sqrt(jumpMultiplier);
    }

    player.grounded = false;
}

// ========================================
// 물약 사용
// ========================================

function canUsePotion(potionId) {
    if (!(potionId in potionInventory)) return false;
    if (resultSent) return false;
    if ((potionInventory[potionId] || 0) < 1) return false;

    // 부활 물약은 게임 오버 후 선택 화면에서만 사용 가능
    if (potionId === "revive") return awaitingRevive;

    // 나머지 물약은 플레이 중에만 사용 가능
    if (gameOver) return false;

    if (potionId === "score_2x" || potionId === "score_3x") {
        // 점수 배수 물약은 한 게임에 하나만
        return scoreMultiplier === 1;
    }

    if (potionId === "jump_2x") {
        return jumpMultiplier < MAX_JUMP_MULTIPLIER;
    }

    if (potionId === "size_2x") {
        return sizeMultiplier < MAX_SIZE_MULTIPLIER;
    }

    return false;
}

function applyPlayerSize() {
    const centerX = player.x + player.width / 2;
    const bottom = player.y + player.height;

    player.width = BASE_PLAYER_WIDTH * sizeMultiplier;
    player.height = BASE_PLAYER_HEIGHT * sizeMultiplier;

    // 발 위치와 가로 중심은 유지한 채로 커진다.
    player.x = Math.min(
        Math.max(0, centerX - player.width / 2),
        canvas.width - player.width
    );
    player.y = bottom - player.height;
}

function usePotion(potionId) {
    if (!canUsePotion(potionId)) return false;

    // 보유 수량 차감 + 사용 기록 추가
    potionInventory[potionId] -= 1;

    potionUses.push({
        event_id: createRunId(),
        potion_id: potionId
    });

    switch (potionId) {
        case "score_2x":
            scoreMultiplier = 2;
            refreshScore();
            break;

        case "score_3x":
            scoreMultiplier = 3;
            refreshScore();
            break;

        case "jump_2x":
            jumpMultiplier *= 2;
            break;

        case "size_2x":
            sizeMultiplier *= 2;
            applyPlayerSize();
            break;

        case "revive":
            reviveAtSafePlatform();
            break;
    }

    // Streamlit에 사용 기록을 알려서 DB에서 차감하게 한다.
    postStateToStreamlit(false);

    return true;
}

// ========================================
// 부활
// ========================================

function reviveAtSafePlatform() {
    // 최고 높이에 도달했던 위치와 가장 가까운 발판에서 부활한다.
    const targetY = startY - maxHeight;

    let best = null;
    let bestDiff = Infinity;

    for (const platform of platforms) {
        const standY = platform.y - player.height;
        const diff = Math.abs(standY - targetY);

        if (diff < bestDiff) {
            best = platform;
            bestDiff = diff;
        }
    }

    if (!best) {
        best = platforms[0];
    }

    player.x = Math.min(
        Math.max(0, best.x + best.width / 2 - player.width / 2),
        canvas.width - player.width
    );
    player.y = best.y - player.height;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = true;

    cameraY = player.y - cameraTargetOffset;

    awaitingRevive = false;
    gameOver = false;
    dragging = false;

    const gameOverElement = document.getElementById("gameOver");

    if (gameOverElement) {
        gameOverElement.style.display = "none";
    }
}

// ========================================
// 마우스 이벤트
// ========================================

// 물약 바 버튼 위치
const potionButtons = (function() {
    const buttonWidth = 140;
    const buttonHeight = 44;
    const gap = 10;
    const totalWidth =
        POTION_BAR_ORDER.length * buttonWidth +
        (POTION_BAR_ORDER.length - 1) * gap;
    const startX = (canvas.width - totalWidth) / 2;
    const y = 648;

    return POTION_BAR_ORDER.map(function(id, index) {
        return {
            id: id,
            x: startX + index * (buttonWidth + gap),
            y: y,
            w: buttonWidth,
            h: buttonHeight
        };
    });
})();

// 부활 선택 화면 버튼 위치
const reviveButtonRect = { x: 190, y: 380, w: 200, h: 56 };
const giveUpButtonRect = { x: 410, y: 380, w: 200, h: 56 };

function handlePotionBarClick(x, y) {
    // 물약 바 영역에서 시작한 클릭은 점프 조준으로 쓰지 않는다.
    if (y < 640) return false;

    for (const button of potionButtons) {
        if (pointInRect(x, y, button)) {
            usePotion(button.id);
            break;
        }
    }

    return true;
}

function handleRevivePromptClick(x, y) {
    if (pointInRect(x, y, reviveButtonRect)) {
        usePotion("revive");
    } else if (pointInRect(x, y, giveUpButtonRect)) {
        finalizeGame();
    }
}

canvas.addEventListener("mousedown", function(event) {
    const pos = getCanvasPos(event);

    if (awaitingRevive) {
        handleRevivePromptClick(pos.x, pos.y);
        return;
    }

    if (gameOver) return;

    if (handlePotionBarClick(pos.x, pos.y)) return;

    dragging = true;

    mouseStartX = pos.x;
    mouseStartY = pos.y;

    mouseX = mouseStartX;
    mouseY = mouseStartY;
});

canvas.addEventListener("mousemove", function(event) {
    if (!dragging) return;

    const pos = getCanvasPos(event);

    mouseX = pos.x;
    mouseY = pos.y;
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

// 키보드 단축키: 1 점수x2, 2 점수x3, 3 점프x2, 4 크기x2
window.addEventListener("keydown", function(event) {
    const potionId = POTION_KEYS[event.key];

    if (potionId) {
        usePotion(potionId);
    }
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

        const heightElement = document.getElementById("height");

        if (heightElement) {
            heightElement.textContent = maxHeight;
        }

        refreshScore();
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

    // 크기 물약으로 커진 비율
    const s = player.width / BASE_PLAYER_WIDTH;

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
    ctx.fillRect(
        player.x + 7 * s,
        screenY + 9 * s,
        5 * s,
        5 * s
    );
    ctx.fillRect(
        player.x + 18 * s,
        screenY + 9 * s,
        5 * s,
        5 * s
    );

    // 발
    ctx.fillStyle = footColor;
    ctx.fillRect(
        player.x + 2 * s,
        screenY + 35 * s,
        10 * s,
        5 * s
    );
    ctx.fillRect(
        player.x + 18 * s,
        screenY + 35 * s,
        10 * s,
        5 * s
    );
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
// 물약 바 그리기
// ========================================

function drawPotionBar() {
    ctx.save();
    ctx.textAlign = "center";

    for (const button of potionButtons) {
        const usable = canUsePotion(button.id);
        const count = potionInventory[button.id] || 0;

        ctx.fillStyle = usable
            ? "rgba(46,125,50,0.92)"
            : "rgba(60,60,60,0.55)";
        ctx.fillRect(button.x, button.y, button.w, button.h);

        ctx.fillStyle = "white";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(
            POTION_LABELS[button.id],
            button.x + button.w / 2,
            button.y + 19
        );

        ctx.font = "12px sans-serif";
        ctx.fillText(
            "보유 " + count,
            button.x + button.w / 2,
            button.y + 36
        );
    }

    ctx.restore();
}

// ========================================
// 부활 선택 화면 그리기
// ========================================

function drawReviveOverlay() {
    if (!awaitingRevive) return;

    ctx.save();
    ctx.textAlign = "center";

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2, 280);

    ctx.font = "20px sans-serif";
    ctx.fillText(
        "❤️ 부활 물약 " + (potionInventory.revive || 0) +
        "개 보유 · 사용하시겠어요?",
        canvas.width / 2,
        335
    );

    ctx.fillStyle = "#e53935";
    ctx.fillRect(
        reviveButtonRect.x,
        reviveButtonRect.y,
        reviveButtonRect.w,
        reviveButtonRect.h
    );

    ctx.fillStyle = "#616161";
    ctx.fillRect(
        giveUpButtonRect.x,
        giveUpButtonRect.y,
        giveUpButtonRect.w,
        giveUpButtonRect.h
    );

    ctx.fillStyle = "white";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(
        "부활 물약 사용",
        reviveButtonRect.x + reviveButtonRect.w / 2,
        reviveButtonRect.y + 35
    );
    ctx.fillText(
        "게임 종료",
        giveUpButtonRect.x + giveUpButtonRect.w / 2,
        giveUpButtonRect.y + 35
    );

    ctx.restore();
}

// ========================================
// 게임 오버
// ========================================

function endGame() {
    if (gameOver) return;

    gameOver = true;
    dragging = false;

    // 부활 물약이 있으면 바로 끝내지 않고 선택 화면을 보여준다.
    // (결과는 아직 Streamlit에 보내지 않는다.)
    if ((potionInventory.revive || 0) > 0) {
        awaitingRevive = true;
        return;
    }

    finalizeGame();
}

// 게임을 최종적으로 끝내고 결과를 저장한다.
function finalizeGame() {
    awaitingRevive = false;
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
    player.width = BASE_PLAYER_WIDTH;
    player.height = BASE_PLAYER_HEIGHT;
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

    // 물약 효과는 게임마다 초기화 (보유 수량은 유지)
    potionUses = [];
    scoreMultiplier = 1;
    jumpMultiplier = 1;
    sizeMultiplier = 1;
    awaitingRevive = false;

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
    drawPotionBar();
    drawReviveOverlay();

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

    // 보유 물약 수량은 게임이 시작될 때 한 번만 받는다.
    // (Streamlit이 다시 실행될 때마다 값이 오지만,
    //  이미 이 게임에서 차감한 수량을 덮어쓰면 안 되기 때문)
    if (
        !inventoryInitialized &&
        args.potions &&
        typeof args.potions === "object"
    ) {
        for (const potionId of Object.keys(potionInventory)) {
            const quantity = parseInt(args.potions[potionId], 10);

            potionInventory[potionId] =
                Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
        }

        inventoryInitialized = true;
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
