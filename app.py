import streamlit as st

from database.db import create_tables


# 데이터베이스 초기화
create_tables()


st.set_page_config(
    page_title="Eco Jump",
    page_icon="🌱",
    layout="wide"
)


st.title("🌱 Eco Jump")

st.write("탄소를 줄이고 더 높이 점프하세요!")

st.success("데이터베이스 연결 완료!")
