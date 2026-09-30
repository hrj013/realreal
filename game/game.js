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
        // 1. 아래에서 발판에 부딪힘
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
        // 2. 위에서 발판에 착지
        // ====================================

        const horizontalCollision =

            playerRight >
                platformLeft - landingTolerance &&

            playerLeft <
                platformRight + landingTolerance;


        const verticalLanding =

            playerBottom >=
                platformTop &&

            playerBottom <=
                platformTop + 20 &&

            player.velocityY >= 0;


        if (
            horizontalCollision &&
            verticalLanding
        ) {

            player.y =
                platformTop -
                player.height;

            player.velocityY =
                0;

            player.grounded =
                true;
        }


        // ====================================
        // 3. 왼쪽 벽 충돌
        // 정확히 발판의 실제 x 범위만 사용
        // ====================================

        const touchingLeftWall =

            playerRight >=
                platformLeft &&

            playerLeft <
                platformLeft &&

            playerBottom >
                platformTop &&

            playerTop <
                platformBottom;


        if (touchingLeftWall) {

            player.x =
                platformLeft -
                player.width;

            player.velocityX =
                0;
        }


        // ====================================
        // 4. 오른쪽 벽 충돌
        // 정확히 발판의 실제 x 범위만 사용
        // ====================================

        const touchingRightWall =

            playerLeft <=
                platformRight &&

            playerRight >
                platformRight &&

            playerBottom >
                platformTop &&

            playerTop <
                platformBottom;


        if (touchingRightWall) {

            player.x =
                platformRight;

            player.velocityX =
                0;
        }
    }
}
