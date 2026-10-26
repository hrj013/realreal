
import streamlit as st

from database.db import (
    create_tables,
    register_user,
    login_user,
    save_game_record,
)

from game_component import eco_jump_game


# -----------------------------------------
# 1. 페이지 설정 및 데이터베이스 초기화
# -----------------------------------------

st.set_page_config(
    page_title="Eco Jump",
    page_icon="🌱",
    layout="centered",
)

create_tables()


# -----------------------------------------
# 2. 세션 상태 초기화
# -----------------------------------------

if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if "user" not in st.session_state:
    st.session_state.user = None

if "playing" not in st.session_state:
    st.session_state.playing = False

# 현재 게임 실행 결과의 중복 저장 방지용
if "saved_game_runs" not in st.session_state:
    st.session_state.saved_game_runs = []

# 게임 종료 결과를 한 번만 처리하기 위한 상태
if "last_game_result" not in st.session_state:
    st.session_state.last_game_result = None

if "game_save_message" not in st.session_state:
    st.session_state.game_save_message = None


# -----------------------------------------
# 3. 메인 페이지
# -----------------------------------------

def home_page():

    # -----------------------------------------
    # 로그인한 사용자 화면
    # -----------------------------------------

    if st.session_state.logged_in:

        user = st.session_state.user

        st.title("🌱 Eco Jump")
        st.success(f"환영합니다, {user[1]}님!")

        # 보유 포인트 표시
        col1, col2 = st.columns(2)

        with col1:
            st.metric("🪙 COIN", user[2])

        with col2:
            st.metric("🌱 GREEN POINT", user[3])

        st.divider()
        st.subheader("🎮 GAME")

        # 게임 시작 버튼
        if st.button(
            "🎮 GAME START",
            use_container_width=True,
        ):
            st.session_state.playing = True
            st.session_state.last_game_result = None
            st.session_state.game_save_message = None
            st.rerun()

        # -----------------------------------------
        # 게임 실행
        # -----------------------------------------

        if st.session_state.playing:

            game_result = eco_jump_game(
                skin=user[4] or "basic",
                key="eco_jump_game",
                default=None,
            )

            # -----------------------------------------
            # 게임 종료 결과 처리 및 저장
            # -----------------------------------------

            if (
                isinstance(game_result, dict)
                and game_result.get("finished") is True
            ):

                run_id = game_result.get("run_id")

                # 실행 ID가 없으면 중복 방지 처리가 불가능하므로
                # 기록을 저장하지 않음
                if not run_id:
                    st.warning(
                        "게임 실행 ID를 받지 못했습니다. "
                        "게임 기록을 저장하지 않았습니다."
                    )

                elif run_id not in st.session_state.saved_game_runs:

                    try:
                        score = max(
                            0,
                            int(game_result.get("score", 0)),
                        )

                        max_height = max(
                            0.0,
                            float(game_result.get("max_height", 0)),
                        )

                        play_time = max(
                            0.0,
                            float(game_result.get("play_time", 0)),
                        )

                        # 현재 로그인한 사용자 ID는 user[0]
                        saved = save_game_record(
                            user_id=user[0],
                            score=score,
                            max_height=max_height,
                            play_time=play_time,
                        )

                        if saved:
                            # 저장 완료한 실행 ID를 기록
                            st.session_state.saved_game_runs.append(
                                run_id
                            )

                            st.session_state.last_game_result = {
                                "run_id": run_id,
                                "score": score,
                                "max_height": max_height,
                                "play_time": play_time,
                            }

                            st.session_state.game_save_message = (
                                "success",
                                "게임 결과가 데이터베이스에 저장되었습니다!",
                            )

                        else:
                            st.session_state.game_save_message = (
                                "error",
                                "게임 기록 저장에 실패했습니다. "
                                "데이터베이스를 확인해주세요.",
                            )

                    except (TypeError, ValueError):
                        st.session_state.game_save_message = (
                            "error",
                            "게임 결과 데이터의 형식이 올바르지 않습니다.",
                        )

                # 이미 처리한 실행 ID라면 DB에 다시 저장하지 않음

            # -----------------------------------------
            # 게임 결과 표시
            # -----------------------------------------

            result = st.session_state.last_game_result

            if result is not None:
                st.divider()
                st.subheader("🏆 게임 결과")

                st.metric(
                    "최고 높이",
                    f"{result['max_height']:g} m",
                )

                st.metric(
                    "최종 점수",
                    result["score"],
                )

                st.write(
                    f"플레이 시간: {result['play_time']}초"
                )

            message = st.session_state.game_save_message

            if message is not None:
                message_type, message_text = message

                if message_type == "success":
                    st.success(message_text)
                else:
                    st.error(message_text)

        st.divider()

        # -----------------------------------------
        # 로그아웃
        # -----------------------------------------

        if st.button("로그아웃"):
            st.session_state.logged_in = False
            st.session_state.user = None
            st.session_state.playing = False
            st.session_state.last_game_result = None
            st.session_state.game_save_message = None
            st.session_state.saved_game_runs = []
            st.rerun()

    # -----------------------------------------
    # 로그인하지 않은 사용자 화면
    # -----------------------------------------

    else:

        st.title("🌱 ECO JUMP")
        st.write("탄소를 줄이고 더 높이 점프하세요!")

        login_tab, signup_tab = st.tabs(
            ["🔐 로그인", "📝 회원가입"]
        )

        # -----------------------------------------
        # 로그인
        # -----------------------------------------

        with login_tab:

            st.subheader("로그인")

            username = st.text_input(
                "아이디",
                key="login_username",
            )

            password = st.text_input(
                "비밀번호",
                type="password",
                key="login_password",
            )

            if st.button(
                "로그인",
                use_container_width=True,
            ):

                if not username or not password:
                    st.warning(
                        "아이디와 비밀번호를 입력해주세요."
                    )

                else:
                    user = login_user(username, password)

                    if user:
                        st.session_state.logged_in = True
                        st.session_state.user = user
                        st.session_state.playing = False
                        st.session_state.last_game_result = None
                        st.session_state.game_save_message = None
                        st.session_state.saved_game_runs = []
                        st.rerun()

                    else:
                        st.error(
                            "아이디 또는 비밀번호가 올바르지 않습니다."
                        )

        # -----------------------------------------
        # 회원가입
        # -----------------------------------------

        with signup_tab:

            st.subheader("회원가입")

            new_username = st.text_input(
                "아이디",
                key="signup_username",
            )

            new_password = st.text_input(
                "비밀번호",
                type="password",
                key="signup_password",
            )

            password_confirm = st.text_input(
                "비밀번호 확인",
                type="password",
                key="signup_password_confirm",
            )

            if st.button(
                "회원가입",
                use_container_width=True,
            ):

                if not new_username or not new_password:
                    st.warning(
                        "아이디와 비밀번호를 입력해주세요."
                    )

                elif new_password != password_confirm:
                    st.error(
                        "비밀번호가 서로 다릅니다."
                    )

                elif len(new_password) < 4:
                    st.warning(
                        "비밀번호는 4자 이상 입력해주세요."
                    )

                else:
                    success = register_user(
                        new_username,
                        new_password,
                    )

                    if success:
                        st.success(
                            "회원가입이 완료되었습니다! "
                            "로그인 탭에서 로그인해주세요."
                        )

                    else:
                        st.error(
                            "이미 존재하는 아이디입니다."
                        )


# -----------------------------------------
# 4. 페이지 메뉴
# -----------------------------------------

pages = {
    "게임": [
        st.Page(
            home_page,
            title="Eco Jump",
            icon="🎮",
            default=True,
        )
    ],
    "환경보호": [
        st.Page(
            "pages/eco_reward.py",
            title="환경보호 보상",
            icon="🌱",
        )
    ],
}

navigation = st.navigation(pages)
navigation.run()
