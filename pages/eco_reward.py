
import streamlit as st
import sqlite3
import json
import base64
import re
from datetime import datetime
from openai import OpenAI

from database.db import get_connection


# ==========================================
# 기본 설정
# ==========================================

AI_MODEL = "gpt-4.1-mini"
AUTO_APPROVE_CONFIDENCE = 0.65

ACTIVITIES = {
    "텀블러 사용": 10,
    "대중교통 이용": 15,
    "자전거 또는 걷기": 15,
    "재활용": 10,
    "일회용품 줄이기": 10,
    "쓰레기 줍기": 20,
    "다회용 용기 사용": 15,
    "기타 환경보호 활동": 10,
}

REWARDS = {
    "나뭇잎 스킨": {
        "cost": 50,
        "skin_id": "leaf",
        "description": "자연을 닮은 나뭇잎 테마",
    },
    "바다 스킨": {
        "cost": 100,
        "skin_id": "ocean",
        "description": "시원한 바다 테마",
    },
    "무지개 스킨": {
        "cost": 200,
        "skin_id": "rainbow",
        "description": "알록달록 무지개 테마",
    },
}


# ==========================================
# 로그인 확인
# ==========================================

if not st.session_state.get("logged_in") or not st.session_state.get("user"):
    st.warning("환경보호 보상 기능은 로그인 후 이용할 수 있어요.")
    st.stop()

user = st.session_state.user
user_id = user[0]
username = user[1]


# ==========================================
# 데이터베이스
# ==========================================

def init_eco_tables():
    """기존 인증 기록을 삭제하지 않고 필요한 테이블과 열을 준비한다."""
    conn = get_connection()
    try:
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS eco_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT,
                activity TEXT NOT NULL DEFAULT '기타 환경보호 활동',
                points INTEGER NOT NULL DEFAULT 0,
                image_data BLOB,
                mime_type TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT '',
                ai_decision TEXT DEFAULT 'review',
                ai_reason TEXT DEFAULT '',
                ai_confidence REAL DEFAULT 0
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS eco_reward_purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                reward_name TEXT NOT NULL,
                cost INTEGER NOT NULL DEFAULT 0,
                skin_id TEXT,
                purchased_at TEXT NOT NULL DEFAULT ''
            )
        """)

        # 기존 테이블은 CREATE TABLE IF NOT EXISTS로 변경되지 않으므로
        # 실제 열 목록을 읽고 빠진 열을 안전하게 추가한다.
        cur.execute("PRAGMA table_info(eco_actions)")
        columns = {row[1] for row in cur.fetchall()}
        migrations = {
            "user_id": "INTEGER NOT NULL DEFAULT 0",
            "username": "TEXT",
            "activity": "TEXT NOT NULL DEFAULT '기타 환경보호 활동'",
            "points": "INTEGER NOT NULL DEFAULT 0",
            "image_data": "BLOB",
            "mime_type": "TEXT",
            "status": "TEXT NOT NULL DEFAULT 'pending'",
            "created_at": "TEXT NOT NULL DEFAULT ''",
            "ai_decision": "TEXT DEFAULT 'review'",
            "ai_reason": "TEXT DEFAULT ''",
            "ai_confidence": "REAL DEFAULT 0",
        }
        for column, definition in migrations.items():
            if column not in columns:
                cur.execute(
                    f"ALTER TABLE eco_actions ADD COLUMN {column} {definition}"
                )

        cur.execute("PRAGMA table_info(eco_reward_purchases)")
        purchase_columns = {row[1] for row in cur.fetchall()}
        purchase_migrations = {
            "user_id": "INTEGER NOT NULL DEFAULT 0",
            "reward_name": "TEXT NOT NULL DEFAULT ''",
            "cost": "INTEGER NOT NULL DEFAULT 0",
            "skin_id": "TEXT",
            "purchased_at": "TEXT NOT NULL DEFAULT ''",
        }
        for column, definition in purchase_migrations.items():
            if column not in purchase_columns:
                cur.execute(
                    f"ALTER TABLE eco_reward_purchases ADD COLUMN {column} {definition}"
                )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

init_eco_tables()


# ==========================================
# OpenAI 연결
# ==========================================

def get_openai_client():
    """API 키는 Streamlit Secrets에서만 읽는다."""
    try:
        api_key = st.secrets["OPENAI_API_KEY"]
    except Exception:
        return None

    if not api_key or not str(api_key).strip():
        return None

    return OpenAI(api_key=str(api_key).strip(), timeout=30.0, max_retries=0)


# ==========================================
# AI 사진 분석
# ==========================================

def analyze_photo(image_bytes, mime_type, activity):
    """
    반환 형식:
    {
        "decision": "approve" 또는 "review",
        "confidence": 0.0 ~ 1.0,
        "reason": "판정 이유"
    }

    사진이 애매하거나 AI 분석에 실패하면 review로 처리한다.
    """

    client = get_openai_client()

    if client is None:
        return {
            "decision": "review",
            "confidence": 0.0,
            "reason": "API 키가 설정되지 않았거나 읽을 수 없어 관리자 확인이 필요합니다.",
        }

    activity_guides = {
        "텀블러 사용": """
            텀블러, 재사용 가능한 컵, 개인 물병 등이 보이는지 확인한다.
            컵에 음료가 들어 있거나 사람이 컵을 들고 있어야만 인정하는 것은 아니다.
            일회용 컵과 구별하기 어렵다면 review로 판단한다.
        """,

        "대중교통 이용": """
            버스, 지하철, 기차 등 대중교통의 내부나 외부,
            승강장, 정류장, 교통 이용 장면 등 활동과 관련된 증거를 찾는다.
            차량 사진만으로 실제 탑승 여부가 불분명할 수 있으므로
            사진이 활동과 관련 있어 보이면 review를 우선 고려한다.
        """,

        "자전거 또는 걷기": """
            자전거, 자전거 주행 장면, 보행 환경, 산책로나 보행 경로 등
            걷기 또는 자전거 활동과 관련된 증거를 찾는다.
            사람의 얼굴이나 전신이 반드시 나와야 하는 것은 아니다.
        """,

        "재활용": """
            재활용 가능한 병, 캔, 종이, 플라스틱 등을 분리하거나
            재활용함에 넣는 장면, 분리배출함 또는 분류된 재활용품을 확인한다.
            재활용품이 이미 분류되어 있는 사진도 관련 증거가 될 수 있다.
        """,

        "일회용품 줄이기": """
            다회용 컵, 장바구니, 개인 식기, 재사용 가능한 물건 등
            일회용품 사용을 줄이는 행동이나 물건을 확인한다.
            사용 중인 장면이 반드시 필요하지는 않다.
        """,

        "쓰레기 줍기": """
            집게, 봉투, 장갑, 수거된 쓰레기, 쓰레기를 줍는 장면 등
            쓰레기 수거 활동과 관련된 증거를 찾는다.
            쓰레기가 많거나 사람이 사진에 반드시 나와야 하는 것은 아니다.
        """,

        "다회용 용기 사용": """
            도시락통, 다회용 식품 용기, 재사용 가능한 음식 포장 용기 등을 확인한다.
            음식이 담겨 있거나 뚜껑이 열려 있어야만 인정하는 것은 아니다.
        """,

        "기타 환경보호 활동": """
            환경보호에 도움이 되는 행동이나 물건이 실제로 보이는지 확인한다.
            나무 심기, 식물 가꾸기, 절약 활동, 환경 정리 등
            다양한 활동을 고려하고 한 가지 유형에만 한정하지 않는다.
        """,
    }

    guide = activity_guides.get(
        activity,
        "사진에서 해당 환경보호 활동과 관련된 시각적 증거를 확인한다."
    )

    prompt = f"""
당신은 Eco Jump 환경보호 활동 인증을 돕는 AI 심사자입니다.

인증하려는 활동: {activity}

이 활동의 판단 기준:
{guide}

중요한 심사 원칙:

1. 사진에서 확인할 수 있는 시각적 증거를 중심으로 판단하세요.
2. 사진이 전문적으로 촬영되었거나 배경이 깨끗할 필요는 없습니다.
3. 사람이 반드시 등장해야 한다고 가정하지 마세요.
4. 얼굴, 장소, 시간, 영수증 등 요청되지 않은 증거를 임의로 요구하지 마세요.
5. 사진에 활동의 핵심 물체나 합리적인 관련 증거가 보인다면
   정상적인 인증일 가능성을 인정하세요.
6. 사진의 구도, 조명, 배경, 촬영 거리만으로 거절하지 마세요.
7. 사진에서 실제 행동 전체가 보이지 않아도 관련 증거가 충분할 수 있습니다.
8. 반대로 활동과 전혀 관련 없는 사진이라면 자동 승인하지 마세요.
9. 사진만으로 실제 행동 여부를 확실히 증명할 수 없다는 점을 고려하세요.
10. 증거가 일부만 보이거나 판단이 어려우면 reject가 아니라 review로 판단하세요.
11. 자동 승인은 사진이 해당 활동과 명확하게 관련되어 있을 때만 하세요.
12. 사진 분석에 실패하거나 내용이 불명확하면 review로 판단하세요.

다음 JSON 형식으로만 응답하세요.
다른 설명이나 마크다운을 추가하지 마세요.

{{
  "decision": "approve 또는 review",
  "confidence": 0.0,
  "reason": "한국어로 작성한 짧은 판단 근거"
}}

confidence는 사진이 해당 활동의 인증 기준을 충족한다고 판단하는 신뢰도입니다.
0.0에서 1.0 사이의 숫자로 작성하세요.

approve는 사진에서 활동과 관련된 충분한 시각적 증거를 찾았을 때만 선택하세요.
불확실하면 review를 선택하세요.
"""

    try:
        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{encoded_image}"

        response = client.responses.create(
            model=AI_MODEL,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": prompt,
                        },
                        {
                            "type": "input_image",
                            "image_url": data_url,
                            "detail": "high",
                        },
                    ],
                }
            ],
        )

        output = response.output_text.strip()

        # 응답에 불필요한 마크다운이 있더라도 JSON 부분을 추출
        match = re.search(r"\{.*\}", output, re.DOTALL)
        if not match:
            raise ValueError("AI 응답에서 JSON을 찾을 수 없습니다.")

        result = json.loads(match.group(0))

        decision = str(result.get("decision", "review")).lower().strip()
        confidence = float(result.get("confidence", 0))
        reason = str(result.get("reason", "판단 근거가 제공되지 않았습니다."))

        confidence = max(0.0, min(1.0, confidence))

        # AI가 임의로 reject를 반환해도 자동 거절하지 않는다.
        if decision not in ("approve", "review"):
            decision = "review"

        # 신뢰도가 충분하지 않으면 관리자 확인으로 전환
        if decision != "approve" or confidence < AUTO_APPROVE_CONFIDENCE:
            decision = "review"

        return {
            "decision": decision,
            "confidence": confidence,
            "reason": reason[:500],
        }

    except Exception as e:
        # AI 요청이 실패해도 앱이 멈추지 않도록 관리자 확인 대기로 저장한다.
        # 원인 유형을 인증 내역에 남겨 문제를 구분할 수 있게 한다.
        error_type = type(e).__name__
        return {
            "decision": "review",
            "confidence": 0.0,
            "reason": (
                f"AI 분석 요청을 완료하지 못했습니다 ({error_type}). "
                "사진은 관리자 확인 대기로 접수됩니다. "
                "잠시 후 다시 시도해도 반복되면 관리자에게 알려 주세요."
            ),
        }


# ==========================================
# 포인트 및 인증 제출
# ==========================================

def submit_action(activity, uploaded_file):
    conn = get_connection()
    cur = conn.cursor()

    try:
        today = datetime.now().strftime("%Y-%m-%d")

        # 같은 사용자의 같은 활동은 하루 한 번만 제출 가능
        cur.execute(
            """
            SELECT id FROM eco_actions
            WHERE user_id = ?
              AND activity = ?
              AND substr(created_at, 1, 10) = ?
            LIMIT 1
            """,
            (user_id, activity, today),
        )

        if cur.fetchone():
            return False, "오늘은 해당 활동을 이미 인증했어요."

        image_bytes = uploaded_file.getvalue()
        mime_type = uploaded_file.type or "image/jpeg"

        if mime_type not in (
            "image/jpeg",
            "image/png",
            "image/webp",
        ):
            return False, "JPG, PNG, WEBP 형식의 사진을 올려 주세요."

        if not image_bytes:
            return False, "사진 파일을 확인할 수 없어요."

        # AI 분석
        with st.spinner("AI가 환경보호 사진을 분석하고 있어요..."):
            result = analyze_photo(image_bytes, mime_type, activity)

        status = (
            "approved"
            if result["decision"] == "approve"
            else "pending"
        )

        points = ACTIVITIES[activity]
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cur.execute(
            """
            INSERT INTO eco_actions
            (
                user_id, username, activity, points,
                image_data, mime_type, status, created_at,
                ai_decision, ai_reason, ai_confidence
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                username,
                activity,
                points,
                sqlite3.Binary(image_bytes),
                mime_type,
                status,
                created_at,
                result["decision"],
                result["reason"],
                result["confidence"],
            ),
        )

        # 자동 승인된 경우에만 즉시 포인트 지급
        if status == "approved":
            cur.execute(
                """
                UPDATE users
                SET green_point = COALESCE(green_point, 0) + ?
                WHERE id = ?
                """,
                (points, user_id),
            )

        conn.commit()

        if status == "approved":
            return True, (
                f"AI 인증 성공! 환경보호 포인트 {points}점을 받았어요. "
                f"판단 근거: {result['reason']}"
            )

        return True, (
            "사진을 접수했어요. 사진이 애매하거나 AI가 확신하지 못해 "
            "관리자 확인 대기 중이에요. 자동으로 거절된 것은 아니에요. "
            f"판단 근거: {result['reason']}"
        )

    except Exception as e:
        conn.rollback()
        return False, f"인증 저장 중 오류가 발생했어요: {e}"

    finally:
        conn.close()


# ==========================================
# 관리자 검토
# ==========================================

def review_action(action_id, approve):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT user_id, points, status
            FROM eco_actions
            WHERE id = ?
            """,
            (action_id,),
        )
        row = cur.fetchone()

        if not row:
            return False, "인증 기록을 찾을 수 없어요."

        target_user_id, points, current_status = row

        if current_status != "pending":
            return False, "이미 처리된 인증이에요."

        new_status = "approved" if approve else "rejected"

        cur.execute(
            """
            UPDATE eco_actions
            SET status = ?
            WHERE id = ? AND status = 'pending'
            """,
            (new_status, action_id),
        )

        if cur.rowcount != 1:
            conn.rollback()
            return False, "인증 상태가 변경되었어요. 새로고침해 주세요."

        if approve:
            cur.execute(
                """
                UPDATE users
                SET green_point = COALESCE(green_point, 0) + ?
                WHERE id = ?
                """,
                (points, target_user_id),
            )

        conn.commit()

        if approve:
            return True, f"인증 승인 완료! {points}점을 지급했어요."

        return True, "인증을 거절 처리했어요."

    except Exception as e:
        conn.rollback()
        return False, f"검토 중 오류가 발생했어요: {e}"

    finally:
        conn.close()


# ==========================================
# 보상 상점
# ==========================================

def purchase_reward(reward_name):
    reward = REWARDS[reward_name]
    cost = reward["cost"]

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            UPDATE users
            SET green_point = green_point - ?
            WHERE id = ?
              AND COALESCE(green_point, 0) >= ?
            """,
            (cost, user_id, cost),
        )

        if cur.rowcount != 1:
            conn.rollback()
            return False, "포인트가 부족해요."

        cur.execute(
            """
            INSERT INTO eco_reward_purchases
            (user_id, reward_name, cost, skin_id, purchased_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user_id,
                reward_name,
                cost,
                reward["skin_id"],
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )

        conn.commit()
        return True, f"{reward_name} 구매 완료!"

    except Exception as e:
        conn.rollback()
        return False, f"구매 중 오류가 발생했어요: {e}"

    finally:
        conn.close()


# ==========================================
# 화면
# ==========================================

st.title("🌱 Eco Jump 환경보호 보상")
st.caption("환경을 보호하고 포인트를 모아 보상을 받아 보세요!")

conn = get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT COALESCE(green_point, 0) FROM users WHERE id = ?",
    (user_id,),
)
point_row = cur.fetchone()
conn.close()

current_points = point_row[0] if point_row else 0
st.metric("🌿 내 환경보호 포인트", f"{current_points} P")

tab_submit, tab_history, tab_shop, tab_admin = st.tabs(
    ["📸 활동 인증", "📋 인증 내역", "🎁 보상 상점", "🛡️ 관리자 검토"]
)


# ------------------------------------------
# 활동 인증
# ------------------------------------------

with tab_submit:
    st.subheader("환경보호 활동 사진 인증")

    activity = st.selectbox(
        "어떤 활동을 했나요?",
        list(ACTIVITIES.keys()),
    )

    st.info(f"인증 성공 시 {ACTIVITIES[activity]}P를 받을 수 있어요.")

    uploaded_file = st.file_uploader(
        "활동 사진 업로드",
        type=["jpg", "jpeg", "png", "webp"],
        help="활동을 알아볼 수 있는 사진을 올려 주세요.",
    )

    if uploaded_file:
        st.image(
            uploaded_file,
            caption="업로드한 사진",
            use_container_width=True,
        )

    if st.button("AI 사진 인증하기", type="primary", use_container_width=True):
        if uploaded_file is None:
            st.warning("먼저 사진을 업로드해 주세요.")
        else:
            ok, message = submit_action(activity, uploaded_file)

            if ok and "AI 인증 성공" in message:
                st.success(message)
            elif ok:
                st.info(message)
            else:
                # 오류 메시지가 바로 사라지지 않도록 여기서는 즉시 rerun하지 않는다.
                st.error(message)


# ------------------------------------------
# 인증 내역
# ------------------------------------------

with tab_history:
    st.subheader("내 인증 내역")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, activity, points, status, created_at,
               ai_decision, ai_reason, ai_confidence
        FROM eco_actions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 100
        """,
        (user_id,),
    )

    records = cur.fetchall()
    conn.close()

    if not records:
        st.info("아직 인증 내역이 없어요.")
    else:
        for record in records:
            (
                action_id,
                activity_name,
                points,
                status,
                created_at,
                ai_decision,
                ai_reason,
                ai_confidence,
            ) = record

            label = {
                "approved": "✅ 승인",
                "pending": "⏳ 관리자 확인 대기",
                "rejected": "❌ 거절",
            }.get(status, status)

            with st.expander(
                f"{label} | {activity_name} | {points}P | {created_at}"
            ):
                st.write(f"인증 번호: {action_id}")
                st.write(f"AI 판단: {ai_decision or 'review'}")
                st.write(
                    f"AI 신뢰도: {float(ai_confidence or 0):.0%}"
                )
                st.write(f"판단 근거: {ai_reason or '기록 없음'}")


# ------------------------------------------
# 보상 상점
# ------------------------------------------

with tab_shop:
    st.subheader("🎁 환경보호 보상 상점")

    for reward_name, reward in REWARDS.items():
        with st.container(border=True):
            st.markdown(f"### {reward_name}")
            st.write(reward["description"])
            st.write(f"가격: **{reward['cost']}P**")

            if st.button(
                f"{reward_name} 구매",
                key=f"buy_{reward['skin_id']}",
                use_container_width=True,
            ):
                ok, message = purchase_reward(reward_name)

                if ok:
                    st.success(message)
                else:
                    st.error(message)

                st.rerun()

    st.divider()
    st.subheader("내가 구매한 보상")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT reward_name, cost, purchased_at
        FROM eco_reward_purchases
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user_id,),
    )
    purchases = cur.fetchall()
    conn.close()

    if purchases:
        for reward_name, cost, purchased_at in purchases:
            st.write(f"🎁 {reward_name} — {cost}P ({purchased_at})")
    else:
        st.info("아직 구매한 보상이 없어요.")


# ------------------------------------------
# 관리자 검토
# ------------------------------------------

with tab_admin:
    st.subheader("🛡️ 관리자 인증 검토")

    try:
        admin_password = st.secrets.get("admin_password", "")
    except Exception:
        admin_password = ""

    if not admin_password:
        st.warning(
            "관리자 비밀번호가 설정되지 않았어요. "
            "Streamlit Secrets에 admin_password를 설정해 주세요."
        )
    else:
        entered_password = st.text_input(
            "관리자 비밀번호",
            type="password",
            key="eco_admin_password",
        )

        if entered_password == admin_password:
            st.success("관리자 인증 완료")

            conn = get_connection()
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, username, activity, points,
                       created_at, ai_reason, ai_confidence
                FROM eco_actions
                WHERE status = 'pending'
                ORDER BY id ASC
                """
            )
            pending_records = cur.fetchall()
            conn.close()

            if not pending_records:
                st.info("검토할 인증이 없어요.")
            else:
                for record in pending_records:
                    (
                        action_id,
                        action_username,
                        activity_name,
                        points,
                        created_at,
                        ai_reason,
                        ai_confidence,
                    ) = record

                    with st.container(border=True):
                        st.markdown(
                            f"**인증 번호 {action_id} — {activity_name}**"
                        )
                        st.write(f"사용자: {action_username or '알 수 없음'}")
                        st.write(f"지급 예정 포인트: {points}P")
                        st.write(f"제출 시간: {created_at}")
                        st.write(
                            f"AI 신뢰도: {float(ai_confidence or 0):.0%}"
                        )
                        st.write(f"AI 판단 근거: {ai_reason or '없음'}")

                        conn = get_connection()
                        cur = conn.cursor()
                        cur.execute(
                            "SELECT image_data, mime_type FROM eco_actions WHERE id = ?",
                            (action_id,),
                        )
                        image_row = cur.fetchone()
                        conn.close()

                        if image_row and image_row[0]:
                            st.image(
                                bytes(image_row[0]),
                                caption="제출된 인증 사진",
                                use_container_width=True,
                            )

                        col1, col2 = st.columns(2)

                        with col1:
                            if st.button(
                                "승인 및 포인트 지급",
                                key=f"approve_{action_id}",
                                use_container_width=True,
                            ):
                                ok, message = review_action(action_id, True)
                                if ok:
                                    st.success(message)
                                else:
                                    st.error(message)
                                st.rerun()

                        with col2:
                            if st.button(
                                "거절",
                                key=f"reject_{action_id}",
                                use_container_width=True,
                            ):
                                ok, message = review_action(action_id, False)
                                if ok:
                                    st.warning(message)
                                else:
                                    st.error(message)
                                st.rerun()
        elif entered_password:
            st.error("관리자 비밀번호가 올바르지 않아요.")
