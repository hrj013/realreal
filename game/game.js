const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


// ========================================
// 캔버스 설정
// ========================================

canvas.width = 800;
canvas.height = 700;


// ========================================
// 게임 설정
// ========================================

const gravity = 0.5;

// 최대 점프 힘
const maxJumpPower = 15;

// 점프 거리 조절
const distancePower = 20;

// 플랫폼 가장자리 허용 범위
const landingTolerance = 12;


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
// 카메라
// ========================================

let cameraY = 0;


// ========================================
// 점수 / 높이
// ========================================

let maxHeight = 0;
let score = 0;


// ========================================
// 게임 상태
// ========================================

let gameOver = false;
let dragging = false;

let mouseStartX = 0;
let mouseStartY = 0;

let mouseX = 0;
let mouseY = 0;


// ========================================
// 플랫폼
// ========================================

const platforms = [];


// 처음 플랫폼
platforms.push({

    x: 50,
    y: 620,

    width: 180,
    height: 20
});


// 두 번째 플랫폼
platforms.push({

    x: 300,
    y: 520,

    width: 160,
    height: 20
});


// 세 번째 플랫폼
platforms.push({

    x: 100,
    y: 410,

    width: 180,
    height: 20
});


// 네 번째 플랫폼
platforms.push({

    x: 420,
    y: 300,

    width: 170,
    height: 20
});


// 다섯 번째 플랫폼
platforms.push({

    x: 200,
    y: 190,

    width: 180,

    height: 20
});


// ========================================
// 무한 플랫폼 생성
// ========================================

let highestPlatformY = 190;


function createNewPlatforms() {

    while (highestPlatformY > cameraY - 1000) {

        const gapY = 90 + Math.random() * 50;

        highestPlatformY -= gapY;


        const width =
            120 + Math.random() * 90;


        const x =
            Math.random() * (canvas.width - width);


        platforms.push({

            x: x,

            y: highestPlatformY,

            width: width,

            height: 20
        });
    }
}


// ========================================
// 플랫폼 정리
// ========================================

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

    if (!player.grounded || gameOver) {
        return;
    }


    const dx =
        targetX - mouseStartX;

    const dy =
        targetY - mouseStartY;


    const distance =
        Math.sqrt(dx * dx + dy * dy);


    if (distance < 10) {
        return;
    }


    let power =
        distance / distancePower;


    power =
        Math.min(power, maxJumpPower);


    // 드래그한 방향으로 점프
    player.velocityX =
        dx / distance * power;


    player.velocityY =
        dy / distance * power;


    player.grounded = false;
}


// ========================================
// 마우스 시작
// ========================================

canvas.addEventListener("mousedown", function(event) {

    if (gameOver) {
        return;
    }


    dragging = true;


    const rect =
        canvas.getBoundingClientRect();


    mouseStartX =
        event.clientX - rect.left;


    mouseStartY =
        event.clientY - rect.top;


    mouseX =
        mouseStartX;


    mouseY =
        mouseStartY;
});


// ========================================
// 마우스 이동
// ========================================

canvas.addEventListener("mousemove", function(event) {

    if (!dragging) {
        return;
    }


    const rect =
        canvas.getBoundingClientRect();


    mouseX =
        event.clientX - rect.left;


    mouseY =
        event.clientY - rect.top;
});


// ========================================
// 마우스 놓기
// ========================================

canvas.addEventListener("mouseup", function() {

    if (!dragging) {
        return;
    }


    dragging = false;


    jump(mouseX, mouseY);
});


// ========================================
// 마우스가 캔버스를 벗어났을 때
// ========================================

canvas.addEventListener("mouseleave", function() {

    if (dragging) {

        dragging = false;

        jump(mouseX, mouseY);
    }
});


// ========================================
// 플레이어 - 플랫폼 충돌
// ========================================

function checkPlatformCollision() {

    player.grounded = false;


    for (const platform of platforms) {

        const playerLeft =
            player.x;

        const playerRight =
            player.x + player.width;

        const playerTop =
            player.y;

        const playerBottom =
            player.y + player.height;


        const platformLeft =
            platform.x;

        const platformRight =
            platform.x + platform.width;

        const platformTop =
            platform.y;

        const platformBottom =
            platform.y + platform.height;


        // ====================================
        // 1. 아래에서 플랫폼에 부딪히는 경우
        // ====================================

        if (

            playerRight >
                platformLeft &&

            playerLeft <
                platformRight &&

            playerTop <
                platformBottom &&

            playerBottom >
                platformBottom &&

            player.velocityY < 0

        ) {

            player.y =
                platformBottom;

            player.velocityY =
                0;
        }


        // ====================================
        // 2. 위에서 플랫폼에 착지
        // ====================================

        const horizontalCollision =

            playerRight >
                platformLeft - landingTolerance &&

            playerLeft <
                platformRight + landingTolerance;


        const verticalLanding =

            playerBottom >= platformTop &&

            playerBottom <=
                platformTop + 20 &&

            player.velocityY >= 0;


        if (
            horizontalCollision &&
            verticalLanding
        ) {

            player.y =
                platformTop - player.height;


            player.velocityY =
                0;


            player.grounded =
                true;
        }


        // ====================================
        // 3. 왼쪽 벽에 충돌
        // ====================================

        if (

            playerRight >
                platformLeft &&

            playerLeft <
                platformLeft &&

            playerBottom >
                platformTop + 5 &&

            playerTop <
                platformBottom - 5

        ) {

            player.x =
                platformLeft -
                player.width;


            player.velocityX =
                0;
        }


        // ====================================
        // 4. 오른쪽 벽에 충돌
        // ====================================

        if (

            playerLeft <
                platformRight &&

            playerRight >
                platformRight &&

            playerBottom >
                platformTop + 5 &&

            playerTop <
                platformBottom - 5

        ) {

            player.x =
                platformRight;


            player.velocityX =
                0;
        }
    }
}


// ========================================
// 플레이어 이동
// ========================================

function updatePlayer() {

    if (gameOver) {
        return;
    }


    // 중력
    player.velocityY += gravity;


    // 이동
    player.x +=
        player.velocityX;

    player.y +=
        player.velocityY;


    // 공기 저항
    player.velocityX *= 0.98;


    // 화면 왼쪽 벽
    if (player.x < 0) {

        player.x = 0;

        player.velocityX = 0;
    }


    // 화면 오른쪽 벽
    if (
        player.x +
        player.width >
        canvas.width
    ) {

        player.x =
            canvas.width -
            player.width;

        player.velocityX = 0;
    }


    // 플랫폼 충돌
    checkPlatformCollision();


    // ====================================
    // 높이 계산
    // ====================================

    const currentHeight =
        Math.max(
            0,
            Math.floor(580 - player.y)
        );


    if (
        currentHeight >
        maxHeight
    ) {

        maxHeight =
            currentHeight;


        score =
            maxHeight;


        document.getElementById(
            "height"
        ).textContent =
            maxHeight;


        document.getElementById(
            "score"
        ).textContent =
            score;
    }


    // ====================================
    // 카메라 이동
    // ====================================

    const targetCameraY =
        player.y - 300;


    if (
        targetCameraY <
        cameraY
    ) {

        cameraY =
            targetCameraY;
    }


    // 새로운 플랫폼 생성
    createNewPlatforms();


    // 오래된 플랫폼 삭제
    removeOldPlatforms();


    // ====================================
    // 아래로 떨어짐
    // ====================================

    if (
        player.y >
        cameraY + 900
    ) {

        endGame();
    }
}


// ========================================
// 플레이어 그리기
// ========================================

function drawPlayer() {

    const screenY =
        player.y - cameraY;


    ctx.fillStyle =
        "#2e7d32";


    ctx.fillRect(

        player.x,

        screenY,

        player.width,

        player.height
    );


    // 얼굴
    ctx.fillStyle =
        "white";


    ctx.fillRect(
        player.x + 7,
        screenY + 9,
        5,
        5
    );


    ctx.fillRect(
        player.x + 18,
        screenY + 9,
        5,
        5
    );


    // 발
    ctx.fillStyle =
        "#1b5e20";


    ctx.fillRect(
        player.x + 2,
        screenY + 35,
        10,
        5
    );


    ctx.fillRect(
        player.x + 18,
        screenY + 35,
        10,
        5
    );
}


// ========================================
// 플랫폼 그리기
// ========================================

function drawPlatforms() {

    for (const platform of platforms) {

        const screenY =
            platform.y - cameraY;


        // 화면 밖이면 그리지 않음
        if (
            screenY < -50 ||
            screenY > canvas.height + 50
        ) {

            continue;
        }


        // 초록색 플랫폼
        ctx.fillStyle =
            "#4caf50";


        ctx.fillRect(

            platform.x,

            screenY,

            platform.width,

            platform.height
        );


        // 밝은 윗부분
        ctx.fillStyle =
            "#81c784";


        ctx.fillRect(

            platform.x,

            screenY,

            platform.width,

            5
        );
    }
}


// ========================================
// 구름
// ========================================

function drawClouds() {

    const cloudPositions = [

        {
            x: 100,
            y: 100
        },

        {
            x: 600,
            y: 250
        },

        {
            x: 350,
            y: 450
        },

        {
            x: 50,
            y: 700
        }
    ];


    for (
        const cloud
        of cloudPositions
    ) {

        const y =
            cloud.y - cameraY * 0.3;


        if (
            y < -100 ||
            y > canvas.height + 100
        ) {

            continue;
        }


        ctx.fillStyle =
            "rgba(255,255,255,0.7)";


        ctx.beginPath();


        ctx.arc(
            cloud.x,
            y,
            25,
            0,
            Math.PI * 2
        );


        ctx.arc(
            cloud.x + 30,
            y - 10,
            30,
            0,
            Math.PI * 2
        );


        ctx.arc(
            cloud.x + 60,
            y,
            25,
            0,
            Math.PI * 2
        );


        ctx.fill();
    }
}


// ========================================
// 점프 방향 표시
// ========================================

function drawAim() {

    if (!dragging || gameOver) {
        return;
    }


    ctx.strokeStyle =
        "rgba(46,125,50,0.6)";


    ctx.lineWidth = 3;


    ctx.beginPath();


    ctx.moveTo(

        player.x +
        player.width / 2,

        player.y -
        cameraY +
        player.height / 2
    );


    ctx.lineTo(

        mouseX,

        mouseY
    );


    ctx.stroke();


    // 조준점
    ctx.fillStyle =
        "#2e7d32";


    ctx.beginPath();


    ctx.arc(
        mouseX,
        mouseY,
        8,
        0,
        Math.PI * 2
    );


    ctx.fill();
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


    // 하늘 그라데이션 느낌
    ctx.fillStyle =
        "rgba(255,255,255,0.15)";


    for (
        let i = 0;
        i < 10;
        i++
    ) {

        ctx.fillRect(
            0,
            i * 80,
            canvas.width,
            40
        );
    }
}


// ========================================
// 게임 오버
// ========================================

function endGame() {

    gameOver = true;


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

    player.x = 100;

    player.y = 580;

    player.velocityX = 0;

    player.velocityY = 0;

    player.grounded = false;


    cameraY = 0;


    maxHeight = 0;

    score = 0;


    gameOver = false;


    // 플랫폼 초기화
    platforms.length = 0;


    platforms.push({

        x: 50,
        y: 620,
        width: 180,
        height: 20
    });


    platforms.push({

        x: 300,
        y: 520,
        width: 160,
        height: 20
    });


    platforms.push({

        x: 100,
        y: 410,
        width: 180,
        height: 20
    });


    platforms.push({

        x: 420,
        y: 300,
        width: 170,
        height: 20
    });


    platforms.push({

        x: 200,
        y: 190,
        width: 180,
        height: 20
    });


    highestPlatformY = 190;


    createNewPlatforms();


    document.getElementById(
        "height"
    ).textContent =
        "0";


    document.getElementById(
        "score"
    ).textContent =
        "0";


    document.getElementById(
        "gameOver"
    ).style.display =
        "none";
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


    requestAnimationFrame(
        gameLoop
    );
}


// ========================================
// 시작
// ========================================

createNewPlatforms();

gameLoop();
