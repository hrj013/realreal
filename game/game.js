const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 700;

// 픽셀 아트가 뭉개지지 않도록 보간을 끈다.
ctx.imageSmoothingEnabled = false;

// ========================================
// 픽셀 스타일 설정
// ========================================

// 픽셀 한 칸의 크기. 배경과 발판은 이 격자에 맞춰 그린다.
const PX = 4;

// 한글 픽셀 폰트 (index.html에서 불러온다. 실패하면 monospace 사용)
const FONT_FAMILY = "'Galmuri14', 'DotGothic16', monospace";

// 레트로 팔레트 (Sweetie 16 기반)
const PAL = {
    ink: "#1a1c2c",
    plum: "#5d275d",
    red: "#b13e53",
    orange: "#ef7d57",
    yellow: "#ffcd75",
    lime: "#a7f070",
    green: "#38b764",
    teal: "#257179",
    navy: "#29366f",
    blue: "#3b5dc9",
    sky: "#41a6f6",
    cyan: "#73eff7",
    white: "#f4f4f4",
    gray: "#94b0c2",
    slate: "#566c86",
    dark: "#333c57"
};

let frameCount = 0;

function setFont(size, bold) {
    ctx.font = (bold ? "bold " : "") + size + "px " + FONT_FAMILY;
}

function snap(value) {
    return Math.round(value / PX) * PX;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function mod(value, n) {
    return ((value % n) + n) % n;
}

// 같은 입력이면 항상 같은 값(0~1)을 돌려주는 해시 (무늬가 깜빡이지 않게)
function hash2(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function rgbCss(c) {
    return (
        "rgb(" +
        Math.round(c[0]) + "," +
        Math.round(c[1]) + "," +
        Math.round(c[2]) + ")"
    );
}

// 모서리가 깎인 픽셀 상자 (바깥 테두리 - 밝은 테두리 - 안쪽 색)
function drawPixelBox(x, y, w, h, fill, edge) {
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + PX, y, w - PX * 2, h);
    ctx.fillRect(x, y + PX, w, h - PX * 2);

    ctx.fillStyle = edge;
    ctx.fillRect(x + PX * 2, y + PX, w - PX * 4, h - PX * 2);
    ctx.fillRect(x + PX, y + PX * 2, w - PX * 2, h - PX * 4);

    ctx.fillStyle = fill;
    ctx.fillRect(x + PX * 2, y + PX * 2, w - PX * 4, h - PX * 4);
}

// 문자열 도트 스프라이트 그리기
function drawSprite(sprite, palette, ox, oy, w, h, flip) {
    const rows = sprite.length;
    const cols = sprite[0].length;
    const cw = w / cols;
    const ch = h / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = sprite[r][flip ? cols - 1 - c : c];

            if (key === ".") continue;

            ctx.fillStyle = palette[key];

            const x0 = Math.round(ox + c * cw);
            const y0 = Math.round(oy + r * ch);
            const x1 = Math.round(ox + (c + 1) * cw);
            const y1 = Math.round(oy + (r + 1) * ch);

            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
    }
}

// 픽셀 원 (해, 달)
function drawPixelCircle(cx, cy, r, color) {
    ctx.fillStyle = color;

    for (let y = -r; y <= r; y += PX) {
        for (let x = -r; x <= r; x += PX) {
            if (x * x + y * y <= r * r) {
                ctx.fillRect(snap(cx + x), snap(cy + y), PX, PX);
            }
        }
    }
}

// ========================================
// 물약 정보
// ========================================

// 게임 설정
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

const POTION_LABELS = {
    revive: "부활",
    score_2x: "점수x2",
    score_3x: "점수x3",
    jump_2x: "점프x2",
    size_2x: "크기x2"
};

// 물약 병 색깔
const POTION_COLORS = {
    revive: "#b13e53",
    score_2x: "#ffcd75",
    score_3x: "#73eff7",
    jump_2x: "#a7f070",
    size_2x: "#c77dff"
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

// 캐릭터가 바라보는 방향 (1: 오른쪽, -1: 왼쪽)
let facing = 1;

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
// 먼지 효과 (점프, 착지)
// ========================================

const particles = [];

function spawnDust(x, y, count, spread) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * spread,
            y: y,
            vx: (Math.random() - 0.5) * 2.4,
            vy: -Math.random() * 1.6,
            life: 0,
            max: 18 + Math.random() * 10,
            size: PX * (1 + Math.floor(Math.random() * 2))
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life += 1;

        if (p.life >= p.max) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    ctx.fillStyle = PAL.white;

    for (const p of particles) {
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillRect(
            snap(p.x),
            snap(p.y - cameraY),
            p.size,
            p.size
        );
    }

    ctx.globalAlpha = 1;
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

    if (player.velocityX > 0.5) facing = 1;
    if (player.velocityX < -0.5) facing = -1;

    spawnDust(
        player.x + player.width / 2,
        player.y + player.height,
        6,
        player.width
    );

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

    spawnDust(
        player.x + player.width / 2,
        player.y + player.height,
        10,
        player.width * 2
    );

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
    const buttonHeight = 52;
    const gap = 10;
    const totalWidth =
        POTION_BAR_ORDER.length * buttonWidth +
        (POTION_BAR_ORDER.length - 1) * gap;
    const startX = (canvas.width - totalWidth) / 2;
    const y = 642;

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

    const wasGrounded = player.grounded;
    const fallSpeed = player.velocityY;

    checkPlatformCollision(previousY);

    if (gameOver) return;

    // 공중에서 발판에 내려앉을 때 먼지 효과
    if (!wasGrounded && player.grounded && fallSpeed > 5) {
        spawnDust(
            player.x + player.width / 2,
            player.y + player.height,
            5,
            player.width
        );
    }

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
// 하늘 (높이에 따라 낮 → 노을 → 저녁 → 밤)
// ========================================

const SKY_STAGES = [
    { at: 0,    top: PAL.sky,  bottom: PAL.cyan },
    { at: 900,  top: PAL.red,  bottom: PAL.yellow },
    { at: 2000, top: PAL.navy, bottom: PAL.plum },
    { at: 3200, top: PAL.ink,  bottom: PAL.navy }
];

// 카메라가 시작 위치에서 얼마나 올라왔는지 (대략 최고 높이와 같다)
function getAltitude() {
    return Math.max(0, 230 - cameraY);
}

function getSkyColors() {
    const altitude = getAltitude();

    let i = 0;

    while (
        i < SKY_STAGES.length - 1 &&
        altitude >= SKY_STAGES[i + 1].at
    ) {
        i++;
    }

    const a = SKY_STAGES[i];
    const b = SKY_STAGES[Math.min(i + 1, SKY_STAGES.length - 1)];
    const f = a === b ? 0 : clamp01((altitude - a.at) / (b.at - a.at));

    return {
        top: mixRgb(hexToRgb(a.top), hexToRgb(b.top), f),
        bottom: mixRgb(hexToRgb(a.bottom), hexToRgb(b.bottom), f),
        night: clamp01((altitude - 1400) / 1600),
        day: clamp01(1 - altitude / 900)
    };
}

// 별 (위치는 고정, 반짝임만 변한다)
const STARS = [];

for (let i = 0; i < 70; i++) {
    STARS.push({
        x: snap(hash2(i, 1) * canvas.width),
        y: snap(hash2(i, 2) * canvas.height),
        big: hash2(i, 3) > 0.8
    });
}

// ========================================
// 배경
// ========================================

function drawBackground(sky) {
    // 부드러운 그라데이션 대신 띠 모양으로 나눠 픽셀 느낌을 낸다.
    const bands = 14;
    const bandHeight = Math.ceil(canvas.height / bands);

    for (let i = 0; i < bands; i++) {
        const t = i / (bands - 1);

        ctx.fillStyle = rgbCss(mixRgb(sky.top, sky.bottom, t));
        ctx.fillRect(0, i * bandHeight, canvas.width, bandHeight + 1);
    }
}

function drawCelestial(sky) {
    // 해 (낮에만)
    if (sky.day > 0.05) {
        ctx.globalAlpha = sky.day;
        drawPixelCircle(110, 120 + getAltitude() * 0.05, 44, PAL.orange);
        drawPixelCircle(110, 120 + getAltitude() * 0.05, 36, PAL.yellow);
        ctx.globalAlpha = 1;
    }

    if (sky.night <= 0.02) return;

    // 별
    for (let i = 0; i < STARS.length; i++) {
        const star = STARS[i];

        // 가끔씩 꺼지면서 반짝이게 한다.
        if (((frameCount >> 5) + i) % 5 === 0) continue;

        const y = mod(star.y - cameraY * 0.05, canvas.height);

        ctx.globalAlpha = sky.night;
        ctx.fillStyle = PAL.white;

        if (star.big) {
            ctx.fillRect(star.x, snap(y) - PX, PX, PX * 3);
            ctx.fillRect(star.x - PX, snap(y), PX * 3, PX);
        } else {
            ctx.fillRect(star.x, snap(y), PX, PX);
        }
    }

    // 달
    const moonX = 640;
    const moonY = 140;

    ctx.globalAlpha = sky.night;
    drawPixelCircle(moonX, moonY, 60, PAL.gray);
    drawPixelCircle(moonX - 4, moonY - 4, 56, PAL.white);

    ctx.fillStyle = PAL.gray;
    ctx.fillRect(snap(moonX - 24), snap(moonY - 20), PX * 3, PX * 3);
    ctx.fillRect(snap(moonX + 16), snap(moonY + 8), PX * 4, PX * 4);
    ctx.fillRect(snap(moonX - 8), snap(moonY + 28), PX * 2, PX * 2);

    ctx.globalAlpha = 1;
}

// ========================================
// 구름
// ========================================

// 구름 모양 (칸 단위: x, y, 너비, 높이)
const CLOUD_SHAPE = [
    [2, 0, 4, 1],
    [1, 1, 6, 1],
    [0, 2, 8, 1],
    [0, 3, 8, 1]
];

const CLOUDS = [
    { x: 100, y: 100, speed: 0.12, unit: 12 },
    { x: 600, y: 250, speed: 0.08, unit: 8 },
    { x: 350, y: 450, speed: 0.10, unit: 12 },
    { x: 50, y: 650, speed: 0.06, unit: 8 },
    { x: 480, y: 20, speed: 0.07, unit: 8 },
    { x: 220, y: 330, speed: 0.05, unit: 8 }
];

function drawClouds(night) {
    const bodyColor = rgbCss(
        mixRgb(hexToRgb(PAL.white), hexToRgb(PAL.slate), night)
    );

    const shadeColor = rgbCss(
        mixRgb(hexToRgb(PAL.gray), hexToRgb(PAL.dark), night)
    );

    const span = canvas.height + 200;

    for (const cloud of CLOUDS) {
        // 화면 밖으로 나가면 반대편에서 다시 나타난다.
        const y = snap(
            mod(cloud.y - cameraY * 0.3 + 100, span) - 100
        );

        const x = snap(
            mod(
                cloud.x + frameCount * cloud.speed + 100,
                canvas.width + 200
            ) - 100
        );

        for (const part of CLOUD_SHAPE) {
            ctx.fillStyle = part[1] === 3 ? shadeColor : bodyColor;
            ctx.fillRect(
                x + part[0] * cloud.unit,
                y + part[1] * cloud.unit,
                part[2] * cloud.unit,
                part[3] * cloud.unit
            );
        }
    }
}

// ========================================
// 플랫폼 그리기
// ========================================

function getPlatformTheme(level) {
    // 높이 올라갈수록 눈 덮인 바위 발판이 된다.
    if (level >= 4) {
        return {
            g1: PAL.white, g2: PAL.cyan,
            hi: "#c8d6df", d1: PAL.gray, d2: PAL.slate
        };
    }

    if (level >= 2) {
        return {
            g1: PAL.green, g2: PAL.teal,
            hi: "#8c5a40", d1: "#7a4b34", d2: "#5b3426"
        };
    }

    return {
        g1: PAL.lime, g2: PAL.green,
        hi: "#a46c4a", d1: "#8b5a3c", d2: "#6b4230"
    };
}

function drawPlatform(platform, screenY) {
    const theme = getPlatformTheme(platform.level || 0);

    const x = snap(platform.x);
    const y = snap(screenY);
    const w = Math.max(PX * 4, snap(platform.width));
    const h = platform.height;
    const cols = w / PX;

    // 같은 발판은 항상 같은 무늬가 나오도록 위치로 시드를 만든다.
    const seedX = Math.floor(platform.x);
    const seedY = Math.floor(platform.y);

    // 옆면과 아랫면 테두리
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - PX, y, w + PX * 2, h + PX);

    // 흙(또는 바위)
    ctx.fillStyle = theme.d1;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = theme.d2;
    ctx.fillRect(x, y + h - PX, w, PX);

    // 흙 알갱이
    for (let c = 0; c < cols; c++) {
        for (let r = 2; r < 4; r++) {
            const v = hash2(seedX + c * 7, seedY + r * 13);

            if (v < 0.16) {
                ctx.fillStyle = theme.d2;
                ctx.fillRect(x + c * PX, y + r * PX, PX, PX);
            } else if (v > 0.92) {
                ctx.fillStyle = theme.hi;
                ctx.fillRect(x + c * PX, y + r * PX, PX, PX);
            }
        }
    }

    // 풀(또는 눈) 두 줄
    ctx.fillStyle = theme.g2;
    ctx.fillRect(x, y, w, PX * 2);

    ctx.fillStyle = theme.g1;
    ctx.fillRect(x, y, w, PX);

    for (let c = 0; c < cols; c++) {
        // 아래로 삐죽 내려온 풀
        if (hash2(seedX + c * 3, seedY + 99) < 0.35) {
            ctx.fillStyle = theme.g2;
            ctx.fillRect(x + c * PX, y + PX * 2, PX, PX);
        }

        // 위로 솟은 풀잎
        if (hash2(seedX + c * 5, seedY + 17) < 0.22) {
            ctx.fillStyle = theme.g1;
            ctx.fillRect(x + c * PX, y - PX, PX, PX);
        }
    }
}

function drawPlatforms() {
    for (const platform of platforms) {
        const screenY = platform.y - cameraY;

        if (
            screenY < -50 ||
            screenY > canvas.height + 50
        ) {
            continue;
        }

        drawPlatform(platform, screenY);
    }
}

// ========================================
// 바닥 그리기
// ========================================

function drawFloor() {
    const screenY = floorY - cameraY;

    if (
        screenY >= canvas.height ||
        screenY + floorHeight <= 0
    ) {
        return;
    }

    const y = snap(screenY);
    const bottom = canvas.height;

    // 윗면 테두리
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, y - PX, canvas.width, PX);

    // 흙
    ctx.fillStyle = "#6b4230";
    ctx.fillRect(0, y, canvas.width, bottom - y);

    // 벽돌 줄무늬
    ctx.fillStyle = "#4f3224";

    for (let row = 0; y + 8 + row * 16 < bottom; row++) {
        const ry = y + 8 + row * 16;

        ctx.fillRect(0, ry, canvas.width, PX);

        for (let bx = (row % 2) * 16; bx < canvas.width; bx += 32) {
            ctx.fillRect(bx, ry + PX, PX, 12);
        }
    }

    // 풀
    ctx.fillStyle = PAL.green;
    ctx.fillRect(0, y, canvas.width, PX * 2);

    ctx.fillStyle = PAL.lime;
    ctx.fillRect(0, y, canvas.width, PX);
}

// ========================================
// 스킨별 플레이어 그리기
// ========================================

// 캐릭터 도트 (6칸 x 8칸)
// L: 새싹 잎  B: 몸  D: 그림자  W: 눈 흰자  K: 눈동자  F: 발
const PLAYER_SPRITE = [
    "...LL.",
    "..LL..",
    ".BBBB.",
    "BBBBBD",
    "BWBBWD",
    "BKBBKD",
    "BBDDBD",
    "FF..FF"
];

const RAINBOW_COLORS = [
    PAL.red, PAL.orange, PAL.yellow, PAL.lime,
    PAL.cyan, PAL.blue, "#c77dff"
];

function getSkinPalette() {
    const base = { W: PAL.white, K: PAL.ink };

    switch (currentSkin) {
        case "leaf":
            base.B = PAL.lime;
            base.D = PAL.green;
            base.F = PAL.teal;
            base.L = PAL.green;
            break;

        case "ocean":
            base.B = PAL.sky;
            base.D = PAL.blue;
            base.F = PAL.navy;
            base.L = PAL.cyan;
            break;

        case "rainbow":
            base.B = RAINBOW_COLORS[
                Math.floor(frameCount / 8) % RAINBOW_COLORS.length
            ];
            base.D = PAL.plum;
            base.F = PAL.ink;
            base.L = PAL.lime;
            break;

        case "basic":
        default:
            base.B = PAL.green;
            base.D = PAL.teal;
            base.F = PAL.ink;
            base.L = PAL.lime;
            break;
    }

    return base;
}

function drawPlayer() {
    const screenY = player.y - cameraY;

    let drawW = player.width;
    let drawH = player.height;

    if (dragging && player.grounded && !gameOver) {
        // 점프 준비 중에는 납작하게 웅크린다.
        drawH *= 0.85;
        drawW *= 1.08;
    } else if (!player.grounded && player.velocityY < -8) {
        // 빠르게 올라갈 때는 길쭉하게 늘어난다.
        drawH *= 1.08;
        drawW *= 0.94;
    }

    const ox = Math.round(player.x + (player.width - drawW) / 2);
    const oy = Math.round(screenY + (player.height - drawH));

    drawSprite(
        PLAYER_SPRITE,
        getSkinPalette(),
        ox,
        oy,
        drawW,
        drawH,
        facing < 0
    );
}

// ========================================
// 점프 조준선 (도트 점선)
// ========================================

function drawAim() {
    if (!dragging || gameOver) return;

    const dx = mouseX - mouseStartX;
    const dy = mouseY - mouseStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) return;

    const power = Math.min(
        distance / distancePower,
        maxJumpPower
    );

    const ratio = power / maxJumpPower;

    const dirX = dx / distance;
    const dirY = dy / distance;

    const fromX = player.x + player.width / 2;
    const fromY = player.y - cameraY + player.height / 2;

    // 세게 끌수록 점선이 길어지고 색이 변한다.
    const length = 48 + ratio * 150;
    const count = Math.floor(length / 20);

    let color = PAL.lime;

    if (ratio >= 0.8) {
        color = PAL.orange;
    } else if (ratio >= 0.4) {
        color = PAL.yellow;
    }

    for (let i = 1; i <= count; i++) {
        const t = i * 20;
        const size = i === count ? PX * 3 : PX * 2;

        const px = snap(fromX + dirX * t - size / 2);
        const py = snap(fromY + dirY * t - size / 2);

        ctx.fillStyle = PAL.ink;
        ctx.fillRect(px - 2, py - 2, size + 4, size + 4);

        ctx.fillStyle = color;
        ctx.fillRect(px, py, size, size);
    }
}

// ========================================
// 물약 바 그리기
// ========================================

// 물약 병 도트 (7칸 x 8칸)
// C: 코르크  G: 유리  L: 물약  S: 반짝임
const BOTTLE_SPRITE = [
    "..CCC..",
    "..GGG..",
    "..GGG..",
    ".GLLLG.",
    "GLSLLLG",
    "GLSLLLG",
    "GLLLLLG",
    ".GGGGG."
];

function drawPotionBar() {
    ctx.save();
    ctx.textAlign = "left";

    for (const button of potionButtons) {
        const usable = canUsePotion(button.id);
        const count = potionInventory[button.id] || 0;

        drawPixelBox(
            button.x,
            button.y,
            button.w,
            button.h,
            usable ? PAL.green : PAL.dark,
            usable ? PAL.lime : PAL.slate
        );

        // 물약 병 (보유 수량이 없으면 회색)
        drawSprite(
            BOTTLE_SPRITE,
            {
                C: "#7a4b34",
                G: "#c8d6df",
                S: PAL.white,
                L: count > 0 ? POTION_COLORS[button.id] : PAL.slate
            },
            button.x + 14,
            button.y + 14,
            21,
            24,
            false
        );

        setFont(14, true);
        ctx.fillStyle = usable ? PAL.white : PAL.gray;
        ctx.fillText(
            POTION_LABELS[button.id],
            button.x + 44,
            button.y + 25
        );

        setFont(14, false);
        ctx.fillStyle = count > 0 ? PAL.yellow : PAL.slate;
        ctx.fillText(
            "보유 " + count,
            button.x + 44,
            button.y + 42
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

    ctx.fillStyle = "rgba(26,28,44,0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawPixelBox(150, 210, 500, 250, PAL.ink, PAL.white);

    setFont(42, true);
    ctx.fillStyle = PAL.red;
    ctx.fillText("GAME OVER", canvas.width / 2 + 3, 283);
    ctx.fillStyle = PAL.orange;
    ctx.fillText("GAME OVER", canvas.width / 2, 280);

    setFont(28, false);
    ctx.fillStyle = PAL.white;
    ctx.fillText("부활 물약을 사용할까요?", canvas.width / 2, 336);

    setFont(14, false);
    ctx.fillStyle = PAL.yellow;
    ctx.fillText(
        "보유 부활 물약: " + (potionInventory.revive || 0) + "개",
        canvas.width / 2,
        362
    );

    drawPixelBox(
        reviveButtonRect.x,
        reviveButtonRect.y,
        reviveButtonRect.w,
        reviveButtonRect.h,
        PAL.red,
        PAL.orange
    );

    drawPixelBox(
        giveUpButtonRect.x,
        giveUpButtonRect.y,
        giveUpButtonRect.w,
        giveUpButtonRect.h,
        PAL.dark,
        PAL.slate
    );

    setFont(28, true);
    ctx.fillStyle = PAL.white;
    ctx.fillText(
        "부활하기",
        reviveButtonRect.x + reviveButtonRect.w / 2,
        reviveButtonRect.y + 38
    );
    ctx.fillText(
        "포기하기",
        giveUpButtonRect.x + giveUpButtonRect.w / 2,
        giveUpButtonRect.y + 38
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

    facing = 1;
    particles.length = 0;

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
    frameCount += 1;

    updatePlayer();
    updateParticles();

    const sky = getSkyColors();

    drawBackground(sky);
    drawCelestial(sky);
    drawClouds(sky.night);
    drawPlatforms();
    drawFloor();
    drawParticles();
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
