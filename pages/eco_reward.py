
import streamlit as st
import sqlite3
from datetime import datetime
from database.db import get_connection

# =========================================
# 페이지 설정
# =========================================

st.set_page_config(
    page_title="Eco Jump | 환경보호 보상",
    page_icon="🌱",
    layout="wide"
)

st.title("🌱 환경보호 실천 보상")
st.write("작은 실천을 기록하고, 초록 포인트를 모아 보상을 받아 보세요!")

# =========================================
# 로그인 확인
# =========================================

if not st.session_state.get("logged_in", False):
    st.warning("환경보호 보상을 이용하려면 먼저 로그인해 주세요.")
    st.stop()

user = st.session_state.get("user")

if not user:
    st.warning("로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요.")
    st.stop()

user_id = user[0]
username = user[1]


# =========================================
# 데이터베이스 초기화
# =========================================

def init_eco_tables():
    conn = get_connection()

    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eco_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                activity_type TEXT NOT NULL,
                description TEXT,
                image_data BLOB NOT NULL,
                image_name TEXT,
                submitted_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                points INTEGER NOT NULL DEFAULT 0,
                reviewed_at TEXT,
                reviewer_note TEXT
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS eco_reward_purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                reward_id TEXT NOT NULL,
                reward_name TEXT NOT NULL,
                cost INTEGER NOT NULL,
                purchased_at TEXT NOT NULL,
                UNIQUE(user_id, reward_id)
            )
        """)

        conn.commit()
    finally:
        conn.close()


init_eco_tables()


# =========================================
# 환경보호 활동 및 포인트
# =========================================

ACTIVITIES = {
    "텀블러 또는 다회용 컵 사용": 10,
    "대중교통 이용": 15,
    "자전거 또는 도보 이동": 15,
    "분리배출 실천": 10,
    "일회용품 줄이기": 10,
    "쓰레기 줍기": 20,
    "다회용기 사용": 15,
    "기타 환경보호 활동": 10
}


# =========================================
# 보상 목록
# =========================================

REWARDS = [
    {
        "id": "leaf",
        "name": "🍃 새싹 스킨",
        "description": "새싹을 테마로 한 캐릭터 보상",
        "cost": 50
    },
    {
        "id": "ocean",
        "name": "🌊 바다 스킨",
        "description": "깨끗한 바다를 테마로 한 보상",
        "cost": 100
    },
    {
        "id": "rainbow",
        "name": "🌈 무지개 스킨",
        "description": "알록달록한 특별 보상",
        "cost": 200
    }
]


# =========================================
# 사용자 정보 가져오기
# =========================================

def get_user_info():
    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT green_point FROM users WHERE id = ?",
            (user_id,)
        )
        result = cursor.fetchone()

        if result is None:
            return None

        return int(result[0] or 0)
    finally:
        conn.close()


# =========================================
# 실천 기록 제출
# =========================================

def submit_action(activity, description, uploaded_file):
    image_bytes = uploaded_file.getvalue()
    today = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()

    try:
        # 같은 활동을 하루에 반복 제출하는 것 방지
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*)
            FROM eco_actions
            WHERE user_id = ?
              AND activity_type = ?
              AND substr(submitted_at, 1, 10) = ?
        """, (user_id, activity, today))

        if cursor.fetchone()[0] > 0:
            return False, "오늘은 이미 같은 활동을 제출했어요."

        cursor.execute("""
            INSERT INTO eco_actions (
                user_id,
                activity_type,
                description,
                image_data,
                image_name,
                submitted_at,
                status,
                points
            )
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        """, (
            user_id,
            activity,
            description,
            sqlite3.Binary(image_bytes),
            uploaded_file.name,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            ACTIVITIES[activity]
        ))

        conn.commit()
        return True, "사진과 실천 기록을 제출했어요! 승인 후 포인트를 받을 수 있어요."

    except sqlite3.Error:
        conn.rollback()
        return False, "저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."

    finally:
        conn.close()


# =========================================
# 포인트 승인 및 지급
# =========================================

def review_action(action_id, approve, note=""):
    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id, points, status
            FROM eco_actions
            WHERE id = ?
        """, (action_id,))

        action = cursor.fetchone()

        if action is None:
            return False, "기록을 찾을 수 없어요."

        target_user_id, points, status = action

        if status != "pending":
            return False, "이미 처리된 기록이에요."

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if approve:
            cursor.execute("""
                UPDATE eco_actions
                SET status = 'approved',
                    reviewed_at = ?,
                    reviewer_note = ?
                WHERE id = ? AND status = 'pending'
            """, (now, note, action_id))

            if cursor.rowcount != 1:
                conn.rollback()
                return False, "기록 상태가 변경되었어요. 다시 확인해 주세요."

            cursor.execute("""
                UPDATE users
                SET green_point = COALESCE(green_point, 0) + ?
                WHERE id = ?
            """, (points, target_user_id))

            if cursor.rowcount != 1:
                conn.rollback()
                return False, "사용자 정보를 찾을 수 없어 포인트를 지급하지 못했어요."

        else:
            cursor.execute("""
                UPDATE eco_actions
                SET status = 'rejected',
                    reviewed_at = ?,
                    reviewer_note = ?
                WHERE id = ? AND status = 'pending'
            """, (now, note, action_id))

            if cursor.rowcount != 1:
                conn.rollback()
                return False, "기록 상태가 변경되었어요. 다시 확인해 주세요."

        conn.commit()

        if approve:
            return True, f"{points}포인트를 지급했어요!"

        return True, "인증을 반려했어요."

    except sqlite3.Error:
        conn.rollback()
        return False, "처리 중 데이터베이스 오류가 발생했어요."

    finally:
        conn.close()


# =========================================
# 보상 구매
# =========================================

def purchase_reward(reward):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id
            FROM eco_reward_purchases
            WHERE user_id = ? AND reward_id = ?
        """, (user_id, reward["id"]))

        if cursor.fetchone():
            return False, "이미 구매한 보상이에요."

        # 포인트 확인 및 차감
        cursor.execute("""
            UPDATE users
            SET green_point = green_point - ?
            WHERE id = ?
              AND COALESCE(green_point, 0) >= ?
        """, (reward["cost"], user_id, reward["cost"]))

        if cursor.rowcount != 1:
            conn.rollback()
            return False, "포인트가 부족해요."

        cursor.execute("""
            INSERT INTO eco_reward_purchases (
                user_id,
                reward_id,
                reward_name,
                cost,
                purchased_at
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            user_id,
            reward["id"],
            reward["name"],
            reward["cost"],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))

        conn.commit()
        return True, "보상을 구매했어요!"

    except sqlite3.IntegrityError:
        conn.rollback()
        return False, "이미 구매한 보상이에요."

    except sqlite3.Error:
        conn.rollback()
        return False, "구매 중 오류가 발생했어요."

    finally:
        conn.close()


# =========================================
# 상단 포인트 표시
# =========================================

green_points = get_user_info()

if green_points is None:
    st.error("사용자 정보를 찾을 수 없어요. 다시 로그인해 주세요.")
    st.stop()

col1, col2 = st.columns(2)

with col1:
    st.metric("🌿 내 초록 포인트", f"{green_points} P")

with col2:
    st.metric("🌎 오늘의 실천", "작은 행동부터 시작!")

st.divider()


# =========================================
# 탭
# =========================================

tab_submit, tab_history, tab_shop, tab_admin = st.tabs([
    "📸 실천 인증",
    "📚 내 기록",
    "🎁 보상 상점",
    "🔐 관리자 승인"
])


# =========================================
# 1. 실천 인증
# =========================================

with tab_submit:
    st.subheader("오늘의 환경보호 실천")

    st.info(
        "활동 사진을 올리면 인증 대기 상태로 저장돼요. "
        "관리자가 승인하면 표시된 포인트가 지급됩니다."
    )

    with st.form("eco_action_form", clear_on_submit=True):
        activity = st.selectbox(
            "어떤 활동을 실천했나요?",
            list(ACTIVITIES.keys())
        )

        st.write(f"예상 보상: **{ACTIVITIES[activity]} P**")

        description = st.text_area(
            "실천 내용",
            placeholder="어떤 환경보호 활동을 했는지 적어 주세요.",
            max_chars=500
        )

        uploaded_file = st.file_uploader(
            "인증 사진 업로드",
            type=["jpg", "jpeg", "png", "webp"],
            help="JPG, PNG, WEBP 형식의 사진을 올려 주세요. 최대 5MB입니다."
        )

        submitted = st.form_submit_button(
            "🌱 실천 인증 제출",
            use_container_width=True
        )

        if submitted:
            if uploaded_file is None:
                st.error("인증 사진을 먼저 업로드해 주세요.")

            elif uploaded_file.size > 5 * 1024 * 1024:
                st.error("사진은 5MB 이하로 업로드해 주세요.")

            elif not description.strip():
                st.error("실천 내용을 입력해 주세요.")

            else:
                success, message = submit_action(
                    activity,
                    description.strip(),
                    uploaded_file
                )

                if success:
                    st.success(message)
                else:
                    st.error(message)


# =========================================
# 2. 내 실천 기록
# =========================================

with tab_history:
    st.subheader("내 환경보호 실천 기록")

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, activity_type, description,
                   image_data, image_name, submitted_at,
                   status, points, reviewer_note
            FROM eco_actions
            WHERE user_id = ?
            ORDER BY id DESC
        """, (user_id,))

        records = cursor.fetchall()

    finally:
        conn.close()

    if not records:
        st.info("아직 제출한 실천 기록이 없어요. 첫 번째 인증을 해 보세요!")

    for record in records:
        (
            action_id,
            activity_type,
            description,
            image_data,
            image_name,
            submitted_at,
            status,
            points,
            reviewer_note
        ) = record

        status_label = {
            "pending": "⏳ 승인 대기",
            "approved": "✅ 승인 완료",
            "rejected": "❌ 반려"
        }.get(status, status)

        with st.container(border=True):
            left, right = st.columns([1, 2])

            with left:
                if image_data:
                    st.image(
                        bytes(image_data),
                        caption=image_name or "인증 사진",
                        use_container_width=True
                    )

            with right:
                st.markdown(f"### {activity_type}")
                st.caption(f"제출 일시: {submitted_at}")
                st.write(description)
                st.write(f"상태: **{status_label}**")

                if status == "approved":
                    st.success(f"+{points}P 지급 완료")
                elif status == "pending":
                    st.write(f"승인 시 받을 포인트: {points}P")

                if reviewer_note:
                    st.caption(f"관리자 메모: {reviewer_note}")


# =========================================
# 3. 보상 상점
# =========================================

with tab_shop:
    st.subheader("🎁 초록 포인트 보상 상점")

    st.write(
        "환경보호 실천으로 모은 포인트를 사용해 보상을 구매할 수 있어요."
    )

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT reward_id
            FROM eco_reward_purchases
            WHERE user_id = ?
        """, (user_id,))

        owned_rewards = {row[0] for row in cursor.fetchall()}

    finally:
        conn.close()

    columns = st.columns(3)

    for index, reward in enumerate(REWARDS):
        with columns[index]:
            with st.container(border=True):
                st.subheader(reward["name"])
                st.write(reward["description"])
                st.write(f"가격: **{reward['cost']} P**")

                if reward["id"] in owned_rewards:
                    st.success("보유 중")

                elif green_points < reward["cost"]:
                    st.button(
                        "포인트 부족",
                        key=f"disabled_{reward['id']}",
                        disabled=True,
                        use_container_width=True
                    )

                elif st.button(
                    "구매하기",
                    key=f"buy_{reward['id']}",
                    use_container_width=True
                ):
                    success, message = purchase_reward(reward)

                    if success:
                        st.success(message)
                        st.rerun()
                    else:
                        st.error(message)

    st.caption(
        "현재 상점은 구매 내역을 저장합니다. "
        "게임 캐릭터에 실제 스킨을 적용하려면 기존 게임 렌더링 코드와 "
        "보유 스킨 정보를 추가로 연결해야 합니다."
    )

    st.divider()
    st.subheader("🧾 내 구매 기록")

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT reward_name, cost, purchased_at
            FROM eco_reward_purchases
            WHERE user_id = ?
            ORDER BY id DESC
        """, (user_id,))

        purchases = cursor.fetchall()

    finally:
        conn.close()

    if purchases:
        for reward_name, cost, purchased_at in purchases:
            st.write(
                f"🎁 {reward_name} · {cost}P · {purchased_at}"
            )
    else:
        st.info("아직 구매한 보상이 없어요.")


# =========================================
# 4. 관리자 인증 및 승인
# =========================================

with tab_admin:
    st.subheader("🔐 환경보호 인증 관리자")

    st.warning(
        "관리자 인증을 설정하기 전에는 승인 기능을 사용할 수 없어요."
    )

    try:
        admin_password = st.secrets.get("admin_password", "")
    except Exception:
        admin_password = ""

    if not admin_password:
        st.error(
            "관리자 비밀번호가 설정되지 않았어요. "
            "Streamlit Secrets에 admin_password를 설정해 주세요."
        )
        st.stop()

    entered_password = st.text_input(
        "관리자 비밀번호",
        type="password",
        key="eco_admin_password"
    )

    if entered_password != admin_password:
        st.info("관리자 비밀번호를 입력하면 승인 대기 기록을 확인할 수 있어요.")

    else:
        st.success("관리자 인증 완료")

        conn = get_connection()

        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.id, a.user_id, u.username,
                       a.activity_type, a.description,
                       a.image_data, a.image_name,
                       a.submitted_at, a.points
                FROM eco_actions AS a
                LEFT JOIN users AS u ON u.id = a.user_id
                WHERE a.status = 'pending'
                ORDER BY a.id ASC
            """)

            pending_records = cursor.fetchall()

        finally:
            conn.close()

        if not pending_records:
            st.info("현재 승인 대기 중인 기록이 없어요.")

        for record in pending_records:
            (
                action_id,
                submitter_id,
                submitter_name,
                activity_type,
                description,
                image_data,
                image_name,
                submitted_at,
                points
            ) = record

            with st.container(border=True):
                st.markdown(f"### 인증 번호 #{action_id}")
                st.write(f"사용자: {submitter_name or submitter_id}")
                st.write(f"활동: {activity_type}")
                st.write(f"제출 일시: {submitted_at}")
                st.write(f"설명: {description}")
                st.write(f"예정 포인트: {points}P")

                if image_data:
                    st.image(
                        bytes(image_data),
                        caption=image_name or "인증 사진",
                        width=400
                    )

                note = st.text_input(
                    "관리자 메모 (선택)",
                    key=f"note_{action_id}"
                )

                approve_col, reject_col = st.columns(2)

                with approve_col:
                    if st.button(
                        "✅ 승인 및 포인트 지급",
                        key=f"approve_{action_id}",
                        use_container_width=True
                    ):
                        success, message = review_action(
                            action_id,
                            True,
                            note.strip()
                        )

                        if success:
                            st.success(message)
                            st.rerun()
                        else:
                            st.error(message)

                with reject_col:
                    if st.button(
                        "❌ 반려",
                        key=f"reject_{action_id}",
                        use_container_width=True
                    ):
                        success, message = review_action(
                            action_id,
                            False,
                            note.strip()
                        )

                        if success:
                            st.success(message)
                            st.rerun()
                        else:
                            st.error(message)
