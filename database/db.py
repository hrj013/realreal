import sqlite3
import hashlib
from pathlib import Path


# 데이터베이스 파일 위치
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "eco_jump.db"


def get_connection():
    """SQLite 데이터베이스 연결"""
    return sqlite3.connect(DB_PATH)


def create_tables():
    """필요한 테이블을 생성"""

    conn = get_connection()
    cursor = conn.cursor()

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

            FOREIGN KEY (user_id)
                REFERENCES users(id)
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

            FOREIGN KEY (user_id)
                REFERENCES users(id)
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

            FOREIGN KEY (user_id)
                REFERENCES users(id),

            FOREIGN KEY (skin_id)
                REFERENCES skins(id),

            UNIQUE(user_id, skin_id)
        )
    """)

    conn.commit()
    conn.close()


def hash_password(password):
    """비밀번호를 안전하게 해시"""
    return hashlib.sha256(password.encode()).hexdigest()


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
        # 이미 존재하는 아이디
        return False

    finally:
        conn.close()


def login_user(username, password):
    """로그인"""

    conn = get_connection()
    cursor = conn.cursor()

    password_hash = hash_password(password)

    cursor.execute("""
        SELECT id, username, coin, green_point, current_skin
        FROM users
        WHERE username = ?
        AND password_hash = ?
    """, (username, password_hash))

    user = cursor.fetchone()

    conn.close()

    return user
