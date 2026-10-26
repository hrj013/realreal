
from pathlib import Path
import streamlit.components.v1 as components

_COMPONENT_DIR = Path(__file__).resolve().parent.parent / "game"

_eco_jump_game_component = components.declare_component(
    "eco_jump_game",
    path=str(_COMPONENT_DIR),
)

def eco_jump_game(skin="basic", key=None, default=None):
    return _eco_jump_game_component(
        skin=skin,
        key=key,
        default=default,
    )
