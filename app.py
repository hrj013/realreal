import streamlit as st

from database.db import (
    create_tables,
    register_user,
    login_user,
    save_game_record,
    get_potion_inventory,
    use_potion,
)
from game_component import eco_jump_game

st.set_page_config(page_title="Eco Jump", page_icon="🌱", layout="centered")
create_tables()

if "logged_in" not in st.session_state:
    st.session_state.logged_in = False
if "user" not in st.session_state:
    st.session_state.user = None
if "playing" not in st.session_state:
    st.session_state.playing = False
if "saved_game_runs" not in st.session_state:
    st.session_state.saved_game_runs = []
if "last_game_result" not in st.session_state:
    st.session_state.last_game_result = None
if "game_save_message" not in st.session_state:
    st.session_state.game_save_message = None
if "revive_response" not in st.session_state:
    st.session_state.revive_response = None
if "handled_revive_events" not in st.session_state:
    st.session_state.handled_revive_events = set()
if "game_component_value_seen" not in st.session_state:
    st.session_state.game_component_value_seen = None

def home_page():
    if st.session_state.logged_in:
        user = st.session_state.user
        user_id = user[0]
        st.title("🌱 Eco Jump")
        st.success(f"환영합니다, {user[1]}님!")

        col1, col2 = st.columns(2)
        with col1:
            st.metric("🪙 COIN", user[2])
        with col2:
            st.metric("🌱 GREEN POINT", user[3])

        inventory = get_potion_inventory(user_id)
        st.caption(f"❤️ 부활 물약 보유량: {inventory.get('revive', 0)}개")
        st.divider()
        st.subheader("🎮 GAME")

        if st.button("🎮 GAME START", use_container_width=True):
            st.session_state.playing = True
            st.session_state.last_game_result = None
            st.session_state.game_save_message = None
            st.session_state.revive_response = None
            st.session_state.game_component_value_seen = None
            st.rerun()

        if st.session_state.playing:
            game_result = eco_jump_game(
                skin=user[4] or "basic",
                revive_response=st.session_state.revive_response,
                key="eco_jump_game",
                default=None,
            )

            if isinstance(game_result, dict):
                event_type = game_result.get("event")

                if event_type == "revive_request":
                    event_id = str(game_result.get("event_id") or "")
                    run_id = str(game_result.get("run_id") or "")
                    if event_id and event_id not in st.session_state.handled_revive_events:
                        ok, message = use_potion(
                            user_id=user_id,
                            potion_id="revive",
                            run_id=run_id,
                            event_id=event_id,
                        )
                        st.session_state.handled_revive_events.add(event_id)
                        st.session_state.revive_response = {
                            "event_id": event_id,
                            "success": bool(ok),
                            "message": message,
                        }
                        st.rerun()

                elif game_result.get("finished") is True:
                    run_id = game_result.get("run_id")
                    if not run_id:
                        st.warning("게임 실행 ID를 받지 못했습니다. 게임 기록을 저장하지 않았습니다.")
                    elif run_id not in st.session_state.saved_game_runs:
                        try:
                            score = max(0, int(game_result.get("score", 0)))
                            max_height = max(0.0, float(game_result.get("max_height", 0)))
                            play_time = max(0.0, float(game_result.get("play_time", 0)))
                            saved = save_game_record(
                                user_id=user_id,
                                score=score,
                                max_height=max_height,
                                play_time=play_time,
                                run_id=run_id,
                            )
                            if saved:
                                st.session_state.saved_game_runs.append(run_id)
                                st.session_state.last_game_result = {
                                    "run_id": run_id,
                                    "score": score,
                                    "max_height": max_height,
                                    "play_time": play_time,
                                }
                                st.session_state.game_save_message = (
                                    "success", "게임 결과가 데이터베이스에 저장되었습니다!"
                                )
                            else:
                                st.session_state.game_save_message = (
                                    "error", "게임 기록 저장에 실패했거나 이미 저장된 게임입니다."
                                )
                        except (TypeError, ValueError):
                            st.session_state.game_save_message = (
                                "error", "게임 결과 데이터의 형식이 올바르지 않습니다."
                            )

            result = st.session_state.last_game_result
            if result is not None:
                st.divider()
                st.subheader("🏆 게임 결과")
                st.metric("최고 높이", f"{result['max_height']:g} m")
                st.metric("최종 점수", result["score"])
                st.write(f"플레이 시간: {result['play_time']}초")

            message = st.session_state.game_save_message
            if message is not None:
                if message[0] == "success":
                    st.success(message[1])
                else:
                    st.error(message[1])

        st.divider()
        if st.button("로그아웃"):
            st.session_state.logged_in = False
            st.session_state.user = None
            st.session_state.playing = False
            st.session_state.last_game_result = None
            st.session_state.game_save_message = None
            st.session_state.saved_game_runs = []
            st.session_state.revive_response = None
            st.session_state.handled_revive_events = set()
            st.rerun()

    else:
        st.title("🌱 ECO JUMP")
        st.write("탄소를 줄이고 더 높이 점프하세요!")
        login_tab, signup_tab = st.tabs(["🔐 로그인", "📝 회원가입"])

        with login_tab:
            st.subheader("로그인")
            username = st.text_input("아이디", key="login_username")
            password = st.text_input("비밀번호", type="password", key="login_password")
            if st.button("로그인", use_container_width=True):
                if not username or not password:
                    st.warning("아이디와 비밀번호를 입력해주세요.")
                else:
                    user = login_user(username, password)
                    if user:
                        st.session_state.logged_in = True
                        st.session_state.user = user
                        st.session_state.playing = False
                        st.session_state.last_game_result = None
                        st.session_state.game_save_message = None
                        st.session_state.saved_game_runs = []
                        st.session_state.revive_response = None
                        st.session_state.handled_revive_events = set()
                        st.rerun()
                    else:
                        st.error("아이디 또는 비밀번호가 올바르지 않습니다.")

        with signup_tab:
            st.subheader("회원가입")
            new_username = st.text_input("아이디", key="signup_username")
            new_password = st.text_input("비밀번호", type="password", key="signup_password")
            password_confirm = st.text_input("비밀번호 확인", type="password", key="signup_password_confirm")
            if st.button("회원가입", use_container_width=True):
                if not new_username or not new_password:
                    st.warning("아이디와 비밀번호를 입력해주세요.")
                elif new_password != password_confirm:
                    st.error("비밀번호가 서로 다릅니다.")
                elif len(new_password) < 4:
                    st.warning("비밀번호는 4자 이상 입력해주세요.")
                elif register_user(new_username, new_password):
                    st.success("회원가입이 완료되었습니다! 로그인 탭에서 로그인해주세요.")
                else:
                    st.error("이미 존재하는 아이디입니다.")

pages = {
    "게임": [st.Page(home_page, title="Eco Jump", icon="🎮", default=True)],
    "환경보호": [st.Page("pages/eco_reward.py", title="환경보호 보상", icon="🌱")],
}
navigation = st.navigation(pages)
navigation.run()
