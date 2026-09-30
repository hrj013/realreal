// ========================================
// ECO JUMP
// 마우스 드래그 점프 버전
// ========================================


const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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

    gravity: 0.5,

    grounded: true

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
// 드래그 상태
// ========================================

let isDragging = false;

let aimStartX = 0;
let aimStartY = 0;

let aimX = 0;
let aimY = 0;


// ========================================
// 점프 힘
// ========================================

// 최대 점프 힘을 조금 줄임

const maxJumpPower = 15;


// ========================================
// 마우스 위치 가져오기
// ========================================

function getMousePosition(event) {

    const rect = canvas.getBoundingClientRect();

    const scaleX =
        canvas.width / rect.width;

    const scaleY =
        canvas.height / rect.height;

    return {

        x:
            (event.clientX - rect.left)
            * scaleX,

        y:
            (event.clientY - rect.top)
            * scaleY

    };

}


// ========================================
// 마우스 누르기
// ========================================

canvas.addEventListener(
    "mousedown",
    function(event) {

        if (!gameRunning) {
            return;
        }

        if (!player.grounded) {
            return;
        }


        const mouse =
            getMousePosition(event);


        isDragging = true;


        aimStartX =
            player.x + player.width / 2;

        aimStartY =
            player.y + player.height / 2;


        aimX = mouse.x;
        aimY = mouse.y;

    }
);


// ========================================
// 마우스 움직이기
// ========================================

canvas.addEventListener(
    "mousemove",
    function(event) {

        if (!isDragging) {
            return;
        }


        const mouse =
            getMousePosition(event);


        aimX = mouse.x;
        aimY = mouse.y;

    }
);


// ========================================
// 마우스 놓기
// ========================================

canvas.addEventListener(
    "mouseup",
    function() {

        if (!isDragging) {
            return;
        }


        isDragging = false;


        jump();

    }
);


// ========================================
// 마우스가 캔버스 밖으로 나간 경우
// ========================================

canvas.addEventListener(
    "mouseleave",
    function() {

        if (isDragging) {

            isDragging = false;

            jump();

        }

    }
);


// ========================================
// 점프
// ========================================

function jump() {

    if (!player.grounded) {
        return;
    }


    const centerX =
        player.x + player.width / 2;

    const centerY =
        player.y + player.height / 2;


    let dx =
        aimX - centerX;

    let dy =
        aimY - centerY;


    // 드래그 거리

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    // 너무 조금 움직였으면 점프하지 않음

    if (distance < 20) {
        return;
    }


    // 방향 벡터

    dx /= distance;
    dy /= distance;


    // ========================================
    // 점프 힘
    // ========================================
    //
    // 이전:
    // distance / 10
    //
    // 현재:
    // distance / 20
    //
    // → 같은 거리를 드래그해도
    //   점프 힘이 더 작아짐
    //

    const power =
        Math.min(
            distance / 20,
            maxJumpPower
        );


    // 점프 방향

    player.velocityX =
        dx * power;

    player.velocityY =
        dy * power;


    player.grounded = false;

}


// ========================================
// 플레이어 업데이트
// ========================================

function updatePlayer() {


    // 중력

    player.velocityY += player.gravity;


    player.x += player.velocityX;

    player.y += player.velocityY;


    // ========================================
    // 좌우 벽
    // ========================================

    if (player.x < 0) {

        player.x = 0;

        player.velocityX *= -0.5;

    }


    if (
        player.x + player.width >
        canvas.width
    ) {

        player.x =
            canvas.width -
            player.width;

        player.velocityX *= -0.5;

    }


    // ========================================
    // 플랫폼 충돌
    // ========================================

    for (const platform of platforms) {

        const playerBottom =
            player.y + player.height;


        const previousBottom =
            playerBottom -
            player.velocityY;


        const horizontalCollision =
            player.x + player.width >
            platform.x
            &&
            player.x <
            platform.x + platform.width;


        const verticalCollision =
            previousBottom <= platform.y
            &&
            playerBottom >= platform.y;


        if (
            player.velocityY >= 0
            &&
            horizontalCollision
            &&
            verticalCollision
        ) {

            player.y =
                platform.y -
                player.height;


            player.velocityY = 0;


            player.velocityX *= 0.8;


            player.grounded = true;


            score += 10;

        }

    }


    // ========================================
    // 높이
    // ========================================

    maxHeight =
        Math.max(
            maxHeight,
            Math.floor(
                580 - player.y
            )
        );


    // ========================================
    // 떨어짐
    // ========================================

    if (
        player.y >
        canvas.height + 100
    ) {

        gameOver();

    }

}


// ========================================
// 배경
// ========================================

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
        "rgba(255,255,255,0.8)";


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const x =
            80 + i * 160;

        const y =
            100 +
            (i % 2) * 80;


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
// 플랫폼
// ========================================

function drawPlatforms() {

    for (const platform of platforms) {

        // 플랫폼

        ctx.fillStyle =
            "#4caf50";


        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            platform.height
        );


        // 잔디

        ctx.fillStyle =
            "#2e7d32";


        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            5
        );

    }

}


// ========================================
// 플레이어
// ========================================

function drawPlayer() {

    // 몸

    ctx.fillStyle =
        "#ff7043";


    ctx.fillRect(
        player.x,
        player.y,
        player.width,
        player.height
    );


    // 눈

    ctx.fillStyle =
        "white";


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

    ctx.fillStyle =
        "#222";


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
// 조준선
// ========================================

function drawAim() {

    if (!isDragging) {
        return;
    }


    const centerX =
        player.x +
        player.width / 2;

    const centerY =
        player.y +
        player.height / 2;


    // 조준선

    ctx.strokeStyle =
        "#ff7043";

    ctx.lineWidth = 4;


    ctx.beginPath();

    ctx.moveTo(
        centerX,
        centerY
    );

    ctx.lineTo(
        aimX,
        aimY
    );

    ctx.stroke();


    // 조준점

    ctx.fillStyle =
        "#ff7043";


    ctx.beginPath();

    ctx.arc(
        aimX,
        aimY,
        8,
        0,
        Math.PI * 2
    );

    ctx.fill();


    // ========================================
    // 힘 표시
    // ========================================

    const dx =
        aimX - centerX;

    const dy =
        aimY - centerY;


    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    const power =
        Math.min(
            distance / 20,
            maxJumpPower
        );


    ctx.fillStyle =
        "#222";


    ctx.font =
        "18px Arial";


    ctx.fillText(
        "POWER: " +
        Math.floor(power),
        20,
        90
    );

}


// ========================================
// HUD
// ========================================

function updateHUD() {

    document.getElementById(
        "height"
    ).textContent =
        maxHeight;


    document.getElementById(
        "score"
    ).textContent =
        score;

}


// ========================================
// 그리기
// ========================================

function draw() {

    drawBackground();

    drawPlatforms();

    drawPlayer();

    drawAim();

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

    player.grounded = true;

    gameRunning = true;


    document.getElementById(
        "gameOver"
    ).style.display =
        "none";


    gameLoop();

}


// ========================================
// 게임 시작
// ========================================

draw();

gameLoop();
