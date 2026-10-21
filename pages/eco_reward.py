
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
