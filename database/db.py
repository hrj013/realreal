import sqlite3
import hashlib
from pathlib import Path


# -----------------------------------------
# 1. 데이터베이스 파일 위치
# -----------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "eco_jump.db"


def get_connection():
    """SQLite 데이터베이스 연결"""
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# -----------------------------------------
# 2. 물약 정보
# -----------------------------------------

POTIONS = {
    "revive": {
        "name": "❤️ 부활 물약",
        "price": 150,
        "description": "게임 오버 후 현재 게임을 이어서 진행합니다.",
    },
    "score_2x": {
        "name": "✨ 점수 2배 물약",
        "price": 50,
        "description": "이번 게임의 점수를 2배로 만듭니다.",
    },
    "score_3x": {
        "name": "💎 점수 3배 물약",
        "price": 100,
        "description": "이번 게임의 점수를 3배로 만듭니다.",
    },
    "jump_2x": {
        "name": "🚀 점프 높이 2배 물약",
        "price": 100,
        "description": "점프 높이를 2배로 만듭니다. 중첩 사용 가능!",
    },
    "size_2x": {
        "name": "🧪 캐릭터 크기 2배 물약",
        "price": 100,
        "description": "캐릭터 크기를 2배로 만듭니다. 중첩 사용 가능!",
    },
}


# -----------------------------------------
# 3. 테이블 생성 및 기존 DB 마이그레이션
# -----------------------------------------

def create_tables():
    """기존 테이블을 유지하면서 필요한 테이블과 컬럼을 추가"""

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 사용자 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                coin INTEGER DEFAULT 0,
                green_point INTEGER DEFAULT 0,
                current_skin TEXT DEFAULT 'basic'
            )
        """)

        # 게임 기록 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                score INTEGER DEFAULT 0,
                max_height REAL DEFAULT 0,
                play_time REAL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # 탄소 기록 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS carbon_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                record_date DATE NOT NULL,
                car_km REAL DEFAULT 0,
                public_transport_km REAL DEFAULT 0,
                electricity_kwh REAL DEFAULT 0,
                meat_meals INTEGER DEFAULT 0,
                total_carbon REAL DEFAULT 0,
                previous_carbon REAL DEFAULT 0,
                reduction REAL DEFAULT 0,
                reward INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # 스킨 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS skins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                price_coin INTEGER DEFAULT 0,
                price_green INTEGER DEFAULT 0,
                image TEXT
            )
        """)

        # 사용자가 가진 스킨
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_skins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                skin_id INTEGER NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (skin_id) REFERENCES skins(id),
                UNIQUE(user_id, skin_id)
            )
        """)

        # 물약 인벤토리
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS potion_inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                potion_id TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, potion_id)
            )
        """)

        # 물약 구매 및 사용 기록
        # event_id로 같은 요청이 중복 처리되는 것을 방지
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS potion_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                potion_id TEXT NOT NULL,
                transaction_type TEXT NOT NULL
                    CHECK(transaction_type IN ('purchase', 'use')),
                quantity INTEGER NOT NULL DEFAULT 1,
                run_id TEXT,
                event_id TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # 기존 DB에 run_id 컬럼이 없다면 추가
        cursor.execute("PRAGMA table_info(game_records)")
        game_record_columns = {
            row[1] for row in cursor.fetchall()
        }

        if "run_id" not in game_record_columns:
            cursor.execute("""
                ALTER TABLE game_records
                ADD COLUMN run_id TEXT
            """)

        # run_id가 있는 게임은 사용자별 중복 저장 방지
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS
            idx_game_records_user_run
            ON game_records(user_id, run_id)
            WHERE run_id IS NOT NULL
        """)

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# -----------------------------------------
# 4. 비밀번호 해시
# -----------------------------------------

def hash_password(password):
    """비밀번호를 해시"""
    return hashlib.sha256(password.encode()).hexdigest()


# -----------------------------------------
# 5. 회원가입
# -----------------------------------------

def register_user(username, password):
    """회원가입"""

    conn = get_connection()
    cursor = conn.cursor()

    password_hash = hash_password(password)

    try:
        cursor.execute("""
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
        """, (username, password_hash))

        conn.commit()
        return True

    except sqlite3.IntegrityError:
        conn.rollback()
        return False

    finally:
        conn.close()


# -----------------------------------------
# 6. 로그인
# -----------------------------------------

def login_user(username, password):
    """로그인한 사용자 정보 반환"""

    conn = get_connection()
    cursor = conn.cursor()

    try:
        password_hash = hash_password(password)

        cursor.execute("""
            SELECT id, username, coin, green_point, current_skin
            FROM users
            WHERE username = ?
            AND password_hash = ?
        """, (username, password_hash))

        return cursor.fetchone()

    finally:
        conn.close()


# -----------------------------------------
# 7. 게임 결과 저장
# -----------------------------------------

def save_game_record(
    user_id,
    score,
    max_height,
    play_time,
    run_id=None,
):
    """
    게임 결과 저장.
    run_id를 전달하면 동일 게임의 중복 저장을 방지한다.
    기존 호출 방식도 사용할 수 있도록 run_id는 선택 사항이다.
    """

    conn = get_connection()
    cursor = conn.cursor()

    try:
        values = (
            int(user_id),
            max(0, int(score)),
            max(0.0, float(max_height)),
            max(0.0, float(play_time)),
        )

        if run_id:
            cursor.execute("""
                INSERT OR IGNORE INTO game_records (
                    user_id,
                    score,
                    max_height,
                    play_time,
                    run_id
                )
                VALUES (?, ?, ?, ?, ?)
            """, (*values, str(run_id)))

            saved = cursor.rowcount == 1

        else:
            cursor.execute("""
                INSERT INTO game_records (
                    user_id,
                    score,
                    max_height,
                    play_time
                )
                VALUES (?, ?, ?, ?)
            """, values)

            saved = True

        conn.commit()
        return saved

    except (sqlite3.Error, TypeError, ValueError):
        conn.rollback()
        return False

    finally:
        conn.close()


# -----------------------------------------
# 8. 물약 인벤토리 조회
# -----------------------------------------

def get_potion_inventory(user_id):
    """사용자가 보유한 모든 물약 수량 반환"""

    inventory = {
        potion_id: 0 for potion_id in POTIONS
    }

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT potion_id, quantity
            FROM potion_inventory
            WHERE user_id = ?
        """, (int(user_id),))

        for potion_id, quantity in cursor.fetchall():
            if potion_id in inventory:
                inventory[potion_id] = int(quantity)

        return inventory

    finally:
        conn.close()


# -----------------------------------------
# 9. 물약 구매
# -----------------------------------------

def purchase_potion(user_id, potion_id, quantity=1):
    """
    물약 구매.
    green_point 차감과 인벤토리 지급을 하나의 트랜잭션으로 처리한다.
    """

    if potion_id not in POTIONS:
        return False, "존재하지 않는 물약입니다."

    try:
        user_id = int(user_id)
        quantity = int(quantity)

        if quantity <= 0:
            return False, "구매 수량이 올바르지 않습니다."

        price = POTIONS[potion_id]["price"] * quantity

    except (TypeError, ValueError):
        return False, "구매 정보가 올바르지 않습니다."

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")

        # 포인트가 충분한 경우에만 차감
        cursor.execute("""
            UPDATE users
            SET green_point = green_point - ?
            WHERE id = ?
              AND green_point >= ?
        """, (price, user_id, price))

        if cursor.rowcount != 1:
            conn.rollback()
            return False, "그린 포인트가 부족합니다."

        # 인벤토리에 수량 추가
        cursor.execute("""
            INSERT INTO potion_inventory (
                user_id, potion_id, quantity
            )
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, potion_id)
            DO UPDATE SET
                quantity = quantity + excluded.quantity,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, potion_id, quantity))

        # 구매 이벤트 기록
        cursor.execute("""
            INSERT INTO potion_transactions (
                user_id,
                potion_id,
                transaction_type,
                quantity,
                event_id
            )
            VALUES (?, ?, 'purchase', ?, ?)
        """, (
            user_id,
            potion_id,
            quantity,
            f"purchase:{user_id}:{potion_id}:{__import__('uuid').uuid4().hex}",
        ))

        conn.commit()
        return True, f"{POTIONS[potion_id]['name']} {quantity}개를 구매했습니다."

    except sqlite3.Error:
        conn.rollback()
        return False, "구매 처리 중 데이터베이스 오류가 발생했습니다."

    finally:
        conn.close()


# -----------------------------------------
# 10. 물약 사용
# -----------------------------------------

def use_potion(user_id, potion_id, run_id, event_id):
    """
    물약 1개 사용.
    - 부활 물약: 한 게임에서 여러 번 사용 가능
    - 점수 배수: 한 게임에서 2배 또는 3배 중 하나만 사용 가능
    - 점프/크기 배수: 여러 번 중첩 사용 가능
    - event_id가 같으면 중복 차감하지 않는다.
    """

    if potion_id not in POTIONS:
        return False, "존재하지 않는 물약입니다."

    if not run_id or not event_id:
        return False, "게임 실행 ID 또는 요청 ID가 없습니다."

    try:
        user_id = int(user_id)
        run_id = str(run_id)
        event_id = str(event_id)
    except (TypeError, ValueError):
        return False, "물약 사용 정보가 올바르지 않습니다."

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")

        # 동일 요청의 중복 처리 방지
        cursor.execute("""
            SELECT id
            FROM potion_transactions
            WHERE event_id = ?
        """, (event_id,))

        if cursor.fetchone():
            conn.rollback()
            return True, "이미 처리된 물약 사용 요청입니다."

        # 점수 배수 물약은 한 게임에서 하나만 허용
        if potion_id in ("score_2x", "score_3x"):
            cursor.execute("""
                SELECT id
                FROM potion_transactions
                WHERE user_id = ?
                  AND run_id = ?
                  AND transaction_type = 'use'
                  AND potion_id IN ('score_2x', 'score_3x')
                LIMIT 1
            """, (user_id, run_id))

            if cursor.fetchone():
                conn.rollback()
                return False, "한 게임에서는 점수 배수 물약을 하나만 사용할 수 있습니다."

        # 인벤토리에서 정확히 1개 차감
        cursor.execute("""
            UPDATE potion_inventory
            SET quantity = quantity - 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND potion_id = ?
              AND quantity >= 1
        """, (user_id, potion_id))

        if cursor.rowcount != 1:
            conn.rollback()
            return False, "보유한 물약이 없습니다."

        # 사용 기록 저장
        cursor.execute("""
            INSERT INTO potion_transactions (
                user_id,
                potion_id,
                transaction_type,
                quantity,
                run_id,
                event_id
            )
            VALUES (?, ?, 'use', 1, ?, ?)
        """, (
            user_id,
            potion_id,
            run_id,
            event_id,
        ))

        conn.commit()
        return True, f"{POTIONS[potion_id]['name']}을(를) 사용했습니다."

    except sqlite3.IntegrityError:
        conn.rollback()
        return False, "이미 처리된 요청이거나 잘못된 사용 기록입니다."

    except sqlite3.Error:
        conn.rollback()
        return False, "물약 사용 중 데이터베이스 오류가 발생했습니다."

    finally:
        conn.close()


# -----------------------------------------
# 11. 현재 게임의 물약 효과 조회
# -----------------------------------------

def get_run_potion_effects(user_id, run_id):
    """
    현재 게임에서 사용한 물약 효과를 계산한다.

    점수 배수: 2배 또는 3배 중 하나
    점프 높이: 2의 사용 횟수 제곱
    캐릭터 크기: 2의 사용 횟수 제곱
    부활: 사용 횟수만큼
    """

    effects = {
        "score_multiplier": 1,
        "jump_multiplier": 1,
        "size_multiplier": 1,
        "revive_used": 0,
    }

    if not run_id:
        return effects

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT potion_id, COUNT(*)
            FROM potion_transactions
            WHERE user_id = ?
              AND run_id = ?
              AND transaction_type = 'use'
            GROUP BY potion_id
        """, (int(user_id), str(run_id)))

        counts = dict(cursor.fetchall())

        if counts.get("score_2x", 0) > 0:
            effects["score_multiplier"] = 2
        elif counts.get("score_3x", 0) > 0:
            effects["score_multiplier"] = 3

        effects["jump_multiplier"] = (
            2 ** counts.get("jump_2x", 0)
        )

        effects["size_multiplier"] = (
            2 ** counts.get("size_2x", 0)
        )

        effects["revive_used"] = counts.get("revive", 0)

        return effects

    finally:
        conn.close()


# -----------------------------------------
# 12. 사용자 포인트 조회
# -----------------------------------------

def get_user_points(user_id):
    """최신 COIN 및 GREEN POINT 조회"""

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT coin, green_point
            FROM users
            WHERE id = ?
        """, (int(user_id),))

        return cursor.fetchone()

    finally:
        conn.close()
        
# -----------------------------------------
# 13. 스킨 (보유 / 장착)
# -----------------------------------------

SKIN_IDS = ("basic", "leaf", "ocean", "rainbow")


def get_owned_skin_ids(user_id):
    """구매한 스킨 ID 집합 (기본 스킨은 항상 보유)"""

    owned = {"basic"}

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT DISTINCT skin_id
            FROM eco_reward_purchases
            WHERE user_id = ?
              AND skin_id IS NOT NULL
              AND skin_id != ''
        """, (int(user_id),))

        for (skin_id,) in cursor.fetchall():
            owned.add(skin_id)

    except sqlite3.OperationalError:
        # 환경보호 보상 페이지를 한 번도 열지 않아
        # 구매 기록 테이블이 아직 없는 경우
        pass

    finally:
        conn.close()

    return owned


def get_current_skin(user_id):
    """현재 장착 중인 스킨 ID 반환 (보유하지 않았거나 이상한 값이면 basic)"""

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT current_skin
            FROM users
            WHERE id = ?
        """, (int(user_id),))

        row = cursor.fetchone()

    finally:
        conn.close()

    skin_id = row[0] if row and row[0] else "basic"

    if skin_id not in SKIN_IDS:
        return "basic"

    if skin_id not in get_owned_skin_ids(user_id):
        return "basic"

    return skin_id


def set_current_skin(user_id, skin_id):
    """스킨 장착. 보유한 스킨만 장착할 수 있다."""

    if skin_id not in SKIN_IDS:
        return False, "존재하지 않는 스킨이에요."

    if skin_id not in get_owned_skin_ids(user_id):
        return False, "보유하지 않은 스킨이에요."

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE users
            SET current_skin = ?
            WHERE id = ?
        """, (skin_id, int(user_id)))

        conn.commit()

        if cursor.rowcount != 1:
            return False, "스킨을 변경하지 못했어요."

        if skin_id == "basic":
            return True, "기본 스킨으로 바꿨어요."

        return True, "스킨을 장착했어요."

    except sqlite3.Error:
        conn.rollback()
        return False, "스킨 변경 중 오류가 발생했어요."

    finally:
        conn.close()
