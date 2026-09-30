// ========================================
// ECO JUMP
// ========================================


// 캔버스 가져오기

const canvas = document.getElementById("gameCanvas");

const ctx = canvas.getContext("2d");


// 게임 크기

canvas.width = 800;
canvas.height = 700;


// ========================================
// 게임 상태
// ========================================

let score = 0;
let maxHeight = 0;

let gameRunning = true;


// ========================================
// 플레이어
// ========================================

const player = {

    x: 380,
    y: 580,

    width: 40,
    height: 50,

    velocityX: 0,
    velocityY: 0,

    speed: 6,

    jumpPower: -13,

    gravity: 0.5
};


// ========================================
// 플랫폼
// ========================================

const platforms = [

    {
        x: 300,
        y: 650,
        width: 200,
        height: 20
    },

    {
        x: 100,
        y: 520,
        width: 180,
        height: 20
    },

    {
        x: 400,
        y: 390,
        width: 180,
        height: 20
    },

    {
        x: 180,
        y: 260,
        width: 180,
        height: 20
    },

    {
        x: 500,
        y: 130,
        width: 180,
        height: 20
    }

];


// ========================================
// 키보드
// ========================================

const keys = {};


window.addEventListener(
    "keydown",
    function(event) {

        keys[event.key] = true;

    }
);


window.addEventListener(
    "keyup",
    function(event) {

        keys[event.key] = false;

    }
);


// ========================================
// 플레이어 업데이트
// ========================================

function updatePlayer() {


    // 좌우 이동

    if (keys["ArrowLeft"]) {

        player.velocityX = -player.speed;

    }

    else if (keys["ArrowRight"]) {

        player.velocityX = player.speed;

    }

    else {

        player.velocityX *= 0.8;

    }


    player.x += player.velocityX;


    // 화면 밖으로 나가지 않게

    if (player.x < 0) {

        player.x = 0;

    }


    if (
        player.x + player.width >
        canvas.width
    ) {

        player.x =
            canvas.width -
            player.width;

    }


    // 중력

    player.velocityY += player.gravity;

    player.y += player.velocityY;


    // 플랫폼 충돌

    for (const platform of platforms) {

        const playerBottom =
            player.y + player.height;


        const previousBottom =
            playerBottom - player.velocityY;


        const hitHorizontal =
            player.x + player.width >
            platform.x
            &&
            player.x <
            platform.x + platform.width;


        const hitVertical =
            previousBottom <= platform.y
            &&
            playerBottom >= platform.y;


        if (
            player.velocityY >= 0
            &&
            hitHorizontal
            &&
            hitVertical
        ) {

            player.y =
                platform.y -
                player.height;


            player.velocityY =
                player.jumpPower;


            score += 10;

        }

    }


    // 높이 계산

    maxHeight = Math.max(
        maxHeight,
        Math.floor(580 - player.y)
    );


    // 떨어지면 게임 오버

    if (player.y > canvas.height + 100) {

        gameOver();

    }

}


// ========================================
// 배경 그리기
// ========================================

function drawBackground() {

    ctx.fillStyle = "#bde0fe";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // 구름

    ctx.fillStyle =
        "rgba(255,255,255,0.8)";


    for (let i = 0; i < 5; i++) {

        const x =
            80 + i * 160;

        const y =
            100 + (i % 2) * 80;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            25,
            0,
            Math.PI * 2
        );

        ctx.arc(
            x + 30,
            y,
            35,
            0,
            Math.PI * 2
        );

        ctx.arc(
            x + 60,
            y,
            25,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }

}


// ========================================
// 플랫폼 그리기
// ========================================

function drawPlatforms() {

    for (const platform of platforms) {


        // 플랫폼

        ctx.fillStyle = "#4caf50";


        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            platform.height
        );


        // 잔디

        ctx.fillStyle = "#2e7d32";


        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            5
        );

    }

}


// ========================================
// 플레이어 그리기
// ========================================

function drawPlayer() {


    // 몸

    ctx.fillStyle = "#ff7043";


    ctx.fillRect(
        player.x,
        player.y,
        player.width,
        player.height
    );


    // 눈

    ctx.fillStyle = "white";


    ctx.fillRect(
        player.x + 8,
        player.y + 10,
        8,
        8
    );


    ctx.fillRect(
        player.x + 24,
        player.y + 10,
        8,
        8
    );


    // 눈동자

    ctx.fillStyle = "#222";


    ctx.fillRect(
        player.x + 11,
        player.y + 13,
        3,
        3
    );


    ctx.fillRect(
        player.x + 27,
        player.y + 13,
        3,
        3
    );

}


// ========================================
// HUD
// ========================================

function updateHUD() {

    document.getElementById(
        "height"
    ).textContent = maxHeight;


    document.getElementById(
        "score"
    ).textContent = score;

}


// ========================================
// 게임 그리기
// ========================================

function draw() {

    drawBackground();

    drawPlatforms();

    drawPlayer();

    updateHUD();

}


// ========================================
// 게임 루프
// ========================================

function gameLoop() {

    if (!gameRunning) {

        return;

    }


    updatePlayer();

    draw();


    requestAnimationFrame(
        gameLoop
    );

}


// ========================================
// 게임 오버
// ========================================

function gameOver() {

    gameRunning = false;


    document.getElementById(
        "finalHeight"
    ).textContent = maxHeight;


    document.getElementById(
        "finalScore"
    ).textContent = score;


    document.getElementById(
        "gameOver"
    ).style.display = "block";

}


// ========================================
// 다시 시작
// ========================================

function restartGame() {

    player.x = 380;

    player.y = 580;

    player.velocityX = 0;

    player.velocityY = 0;


    score = 0;

    maxHeight = 0;


    gameRunning = true;


    document.getElementById(
        "gameOver"
    ).style.display = "none";


    gameLoop();

}


// ========================================
// 게임 시작
// ========================================

draw();

gameLoop();
