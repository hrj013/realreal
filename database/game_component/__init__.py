
from pathlib import Path

import streamlit.components.v1 as components

_COMPONENT_DIR = Path(__file__).parent

_eco_jump_component = components.declare_component(
    "eco_jump_game",
    path=str(_COMPONENT_DIR),
)


def eco_jump_game(skin="basic", key=None, default=None):
    """게임을 표시하고 JavaScript에서 전달된 결과를 반환한다."""
    return _eco_jump_component(
        skin=skin,
        key=key,
        default=default,
    )
