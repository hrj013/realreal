import streamlit as st
import streamlit.components.v1 as components

from pathlib import Path

from database.db import (
    create_tables,
    register_user,
    login_user
)


# -------------------------
# 게임 HTML 불러오기
# -------------------------

def load_game_html():

    game_folder = Path(__file__).parent / "game"

    html = (
        game_folder / "index.html"
    ).read_text(encoding="utf-8")

    css = (
        game_folder / "game.css"
    ).read_text(encoding="utf-8")

    js = (
        game_folder / "game.js"
    ).read_text(encoding="utf-8")


    # CSS를 HTML 안에 넣기

    html = html.replace(
        '<link rel="stylesheet" href="game.css">',
        f"<style>{css}</style>"
    )


    # JavaScript를 HTML 안에 넣기

    html = html.replace(
        '<script src="game.js"></script>',
        f"<script>{js}</script>"
    )


    return html


# -------------------------
# 데이터베이스 초기화
# -------------------------

create_tables()


# -------------------------
# 페이지 설정
# -------------------------

st.set_page_config(
    page_title="Eco Jump",
    page_icon="🌱",
    layout="centered"
)


# -------------------------
# 세션 상태 초기화
# -------------------------

if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if "user" not in st.session_state:
    st.session_state.user = None

if "playing" not in st.session_state:
    st.session_state.playing = False


# -------------------------
# 로그인된 경우
# -------------------------

if st.session_state.logged_in:

    user = st.session_state.user

    st.title("🌱 Eco Jump")

    st.success(
        f"환영합니다, {user[1]}님!"
    )

    st.write("---")


    # -------------------------
    # 코인 / 그린 포인트
    # -------------------------

    col1, col2 = st.columns(2)

    with col1:

        st.metric(
            "🪙 COIN",
            user[2]
        )

    with col2:

        st.metric(
            "🌱 GREEN POINT",
            user[3]
        )


    st.write("")


    # -------------------------
    # 게임
    # -------------------------

    st.subheader("🎮 GAME")


    if st.button(
        "🎮 GAME START",
        use_container_width=True
    ):

        st.session_state.playing = True


    # 게임 실행

    if st.session_state.playing:

        game_html = load_game_html()

        components.html(
            game_html,
            height=720,
            scrolling=False
        )


    st.write("")


    # -------------------------
    # 로그아웃
    # -------------------------

    if st.button(
        "로그아웃"
    ):

        st.session_state.logged_in = False

        st.session_state.user = None

        st.session_state.playing = False

        st.rerun()


# -------------------------
# 로그인하지 않은 경우
# -------------------------

else:

    st.title("🌱 ECO JUMP")

    st.write(
        "탄소를 줄이고 더 높이 점프하세요!"
    )

    st.write("")


    # -------------------------
    # 탭
    # -------------------------

    login_tab, signup_tab = st.tabs(
        ["🔐 로그인", "📝 회원가입"]
    )


    # =========================
    # 로그인
    # =========================

    with login_tab:

        st.subheader("로그인")


        username = st.text_input(
            "아이디",
            key="login_username"
        )


        password = st.text_input(
            "비밀번호",
            type="password",
            key="login_password"
        )


        if st.button(
            "로그인",
            use_container_width=True
        ):

            if not username or not password:

                st.warning(
                    "아이디와 비밀번호를 입력해주세요."
                )

            else:

                user = login_user(
                    username,
                    password
                )


                if user:

                    st.session_state.logged_in = True

                    st.session_state.user = user

                    st.session_state.playing = False

                    st.success(
                        "로그인 성공!"
                    )

                    st.rerun()


                else:

                    st.error(
                        "아이디 또는 비밀번호가 올바르지 않습니다."
                    )


    # =========================
    # 회원가입
    # =========================

    with signup_tab:

        st.subheader("회원가입")


        new_username = st.text_input(
            "아이디",
            key="signup_username"
        )


        new_password = st.text_input(
            "비밀번호",
            type="password",
            key="signup_password"
        )


        password_confirm = st.text_input(
            "비밀번호 확인",
            type="password",
            key="signup_password_confirm"
        )


        if st.button(
            "회원가입",
            use_container_width=True
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
                    new_password
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
