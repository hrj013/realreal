# game_component/__init__.py

from pathlib import Path

import streamlit.components.v1 as components


# 현재 __init__.py가 들어 있는 폴더
_COMPONENT_DIR = Path(__file__).parent

# 로컬 HTML/JS 게임을 Streamlit 커스텀 컴포넌트로 등록
_eco_jump_game_component = components.declare_component(
    "eco_jump_game",
    path=str(_COMPONENT_DIR),
)


def eco_jump_game(
    skin="basic",
    key=None,
    default=None,
):
    """
    Eco Jump 게임을 표시하고 게임 종료 결과를 Streamlit으로 반환한다.

    반환값 예시:
    {
        "run_id": "게임 한 판의 고유 ID",
        "score": 120,
        "max_height": 120,
        "play_time": 35.5
    }
    """
    return _eco_jump_game_component(
        skin=skin,
        key=key,
        default=default,
    )
