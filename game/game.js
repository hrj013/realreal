```javascript
// ========================================
// Eco Jump
// 기본 점프 게임
// ========================================


// -------------------------
// Canvas 설정
// -------------------------

const canvas = document.getElementById("gameCanvas");

const ctx = canvas.getContext("2d");


// 실제 게임 해상도

canvas.width = 800;
canvas.height = 700;


// -------------------------
// 게임 상태
// -------------------------

let gameRunning = true;

let score = 0;

let maxHeight = 0;


// -------------------------
// 키보드
// -------------------------

const keys = {};

window.addEventListener("keydown", function(event) {

    keys[event.key] = true;

});


window.addEventListener("keyup", function(event) {

    keys[event.key] = false;

});


// -------------------------
// 플레이어
// -------------------------

const player = {

    x: 380,

    y: 600,

    width: 35,

    height: 45,

    velocityX: 0,

    velocityY: 0,

    speed: 5,

    jumpPower: -13,

    gravity: 0.5,

    grounded: false

};


// -------------------------
// 플랫폼
// -------------------------

let platforms = [

    {
        x: 300,
        y: 650,
        width: 200,
        height: 20
    },

    {
        x: 100,
        y: 540,
        width: 180,
        height: 20
    },

    {
        x: 400,
        y: 430,
        width: 180,
        height: 20
    },

    {
        x: 180,
        y: 320,
        width: 160,
        height: 20
    },

    {
        x: 500,
        y: 210,
        width: 180,
        height: 20
    },

    {
        x: 300,
        y: 100,
        width: 160,
        height: 20
    }

];


// -------------------------
// 카메라
// -------------------------

let cameraY = 0;


// -------------------------
// 플레이어 업데이트
// -------------------------

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


    // 화면 밖으로 못 나가게

    if (player.x < 0) {

        player.x = 0;

    }

    if (player.x + player.width > canvas.width) {

        player.x =
            canvas.width -
            player.width;

    }


    // 중력

    player.velocityY += player.gravity;

    player.y += player.velocityY;


    player.grounded = false;


    // 플랫폼 충돌

    for (const platform of platforms) {

        const playerBottom =
            player.y + player.height;


        const previousBottom =
            playerBottom - player.velocityY;


        const platformTop =
            platform.y;


        const horizontalCollision =
            player.x + player.width >
                platform.x
            &&
            player.x <
                platform.x + platform.width;


        const verticalCollision =
            previousBottom <= platformTop
            &&
            playerBottom >= platformTop;


        if (
            player.velocityY >= 0
            &&
            horizontalCollision
            &&
            verticalCollision
        ) {

            player.y =
                platformTop -
                player.height;

            player.velocityY =
                player.jumpPower;

            player.grounded = true;

            score += 10;

        }

    }


    // 카메라 이동

    const targetCameraY =
        player.y - 350;


    if (
        targetCameraY < cameraY
    ) {

        cameraY =
            targetCameraY;

    }


    // 높이 계산

    maxHeight =
        Math.max(
            maxHeight,
            Math.floor(
                650 -
                player.y +
                cameraY
            )
        );


    // 떨어졌을 경우

    if (
        player.y -
        cameraY >
        canvas.height + 100
    ) {

        gameOver();

    }

}


// -------------------------
// 플랫폼 그리기
// -------------------------

function drawPlatforms() {

    for (const platform of platforms) {

        const screenY =
            platform.y -
            cameraY;


        // 화면에 보이는 플랫폼만

        if (
            screenY > -50
            &&
            screenY < canvas.height + 50
        ) {

            ctx.fillStyle =
                "#4caf50";

            ctx.fillRect(
                platform.x,
                screenY,
                platform.width,
                platform.height
            );


            // 플랫폼 위 잔디

            ctx.fillStyle =
                "#2e7d32";

            ctx.fillRect(
                platform.x,
                screenY,
                platform.width,
                5
            );

        }

    }

}


// -------------------------
// 플레이어 그리기
// -------------------------

function drawPlayer() {

    const screenY =
        player.y -
        cameraY;


    // 몸

    ctx.fillStyle =
        "#ff7043";

    ctx.fillRect(
        player.x,
        screenY,
        player.width,
        player.height
    );


    // 얼굴

    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        player.x + 7,
        screenY + 10,
        7,
        7
    );

    ctx.fillRect(
        player.x + 21,
        screenY + 10,
        7,
        7
    );


    // 눈동자

    ctx.fillStyle =
        "#222";

    ctx.fillRect(
        player.x + 10,
        screenY + 12,
        3,
        3
    );

    ctx.fillRect(
        player.x + 24,
        screenY + 12,
        3,
        3
    );

}


// -------------------------
// 배경
// -------------------------

function drawBackground() {

    ctx.fillStyle =
        "#bde0fe";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // 구름

    ctx.fillStyle =
        "rgba(255,255,255,0.7)";


    for (
        let i = 0;
        i < 6;
        i++
    ) {

        const x =
            (i * 160 + 50) % 800;

        const y =
            ((i * 130)
            - cameraY * 0.2)
            % 700;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            25,
            0,
            Math.PI * 2
        );

        ctx.arc(
            x + 25,
            y,
            35,
            0,
            Math.PI * 2
        );

        ctx.arc(
            x + 55,
            y,
            25,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }

}


// -------------------------
// 화면 업데이트
// -------------------------

function updateHUD() {

    document.getElementById(
        "height"
    ).textContent = maxHeight;


    document.getElementById(
        "score"
    ).textContent = score;

}


// -------------------------
// 게임 그리기
// -------------------------

function draw() {

    drawBackground();

    drawPlatforms();

    drawPlayer();

    updateHUD();

}


// -------------------------
// 게임 루프
// -------------------------

function gameLoop() {

    if (gameRunning) {

        updatePlayer();

        draw();

        requestAnimationFrame(
            gameLoop
        );

    }

}


// -------------------------
// 게임 종료
// -------------------------

function gameOver() {

    gameRunning = false;


    document.getElementById(
        "finalHeight"
    ).textContent =
        maxHeight;


    document.getElementById(
        "finalScore"
    ).textContent =
        score;


    document.getElementById(
        "gameOver"
    ).style.display =
        "block";

}


// -------------------------
// 다시 시작
// -------------------------

function restartGame() {

    player.x = 380;

    player.y = 600;

    player.velocityX = 0;

    player.velocityY = 0;


    cameraY = 0;

    score = 0;

    maxHeight = 0;


    gameRunning = true;


    document.getElementById(
        "gameOver"
    ).style.display =
        "none";


    gameLoop();

}


// -------------------------
// 게임 시작
// -------------------------

gameLoop();
```
