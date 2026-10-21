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
