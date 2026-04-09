"""
components/session.py
Centralises all st.session_state initialisation and derived URL computation.
Call `init_session_state()` once at the top of app.py.
"""
import os
import streamlit as st
from urllib.parse import urlparse, urlunparse
from config import DB_URL


def _derive_ws_url(http_base: str) -> str:
    """Convert an HTTP(S) base URL to a WS(S) /socket URL."""
    try:
        u = urlparse(http_base)
        ws_scheme = "wss" if u.scheme == "https" else "ws"
        return urlunparse((ws_scheme, u.netloc, "/socket", "", "", ""))
    except Exception:
        return "ws://localhost:5000/socket"


def init_session_state() -> None:
    """Initialise every key used across the app (idempotent)."""
    defaults = {
        "cookies": None,
        "username": None,
        "backend_base": os.getenv(
            "BACKEND_BASE_URL",
            "https://ai-cradle-monitoring-system-production.up.railway.app",
        ).rstrip("/"),
        "sim_token": os.getenv("SIMULATOR_TOKEN", "default-simulator-token"),
        "db_url": DB_URL,
        "ws": None,
        "frame_counter": 0,
        "video_frame_counter": 0,
        "last_video_temp": 75.0,
        "auto_send_thread": None,
        "auto_send_stop": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def get_api_url() -> str:
    base = st.session_state.backend_base.rstrip("/")
    return f"{base}/api"


def get_ws_url() -> str:
    explicit_ws = os.getenv("WEBSOCKET_URL")
    base = st.session_state.backend_base.rstrip("/")
    return explicit_ws or _derive_ws_url(base)
