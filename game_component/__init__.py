from pathlib import Path
import streamlit.components.v1 as components

_COMPONENT_DIR = Path(__file__).resolve().parent.parent / "game"

_eco_jump_game_component = components.declare_component(
    "eco_jump_game",
    path=str(_COMPONENT_DIR),
)


def eco_jump_game(skin="basic", potions=None, key=None, default=None):
    """
    skin   : 현재 장착한 스킨 이름
    potions: 게임 시작 시점의 보유 물약 수량 (예: {"revive": 2, "score_2x": 1})
    """
    return _eco_jump_game_component(
        skin=skin,
        potions=potions or {},
        key=key,
        default=default,
    )
