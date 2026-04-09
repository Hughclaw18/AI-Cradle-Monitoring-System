"""
app.py — Smart Cradle Monitor Simulator
Entry point: initialises session state, renders the sidebar, loads ML models,
then delegates each UI section to its own tab component.
"""
import streamlit as st

# ── Page config (must be first Streamlit call) ────────────────────────────────
st.set_page_config(
    page_title="Smart Cradle Monitor — Simulator",
    page_icon="👶",
    layout="wide",
)

# ── Shared component imports ──────────────────────────────────────────────────
from components.session import init_session_state
from components.sidebar import render_sidebar
from components.websocket_manager import ensure_ws_connection, is_connected

# ── Tab component imports ─────────────────────────────────────────────────────
from components.tabs import sensor_tab, image_tab, video_tab, audio_tab

# ── Model loader imports ──────────────────────────────────────────────────────
from utils.model_loader import (
    load_posture_detection_model,
    load_object_detection_model,
    load_yamnet_model,
)

# ─────────────────────────────────────────────────────────────────────────────
# 1. Initialise session state (idempotent — safe to call on every rerun)
# ─────────────────────────────────────────────────────────────────────────────
init_session_state()

# ─────────────────────────────────────────────────────────────────────────────
# 1b. Keep WebSocket alive — auto-reconnect on every rerun when logged in
# ─────────────────────────────────────────────────────────────────────────────
if st.session_state.cookies and (
    st.session_state.ws is None or not st.session_state.ws.connected
):
    ensure_ws_connection()

# ─────────────────────────────────────────────────────────────────────────────
# 2. Sidebar: connection settings + authentication
# ─────────────────────────────────────────────────────────────────────────────
render_sidebar()

# ─────────────────────────────────────────────────────────────────────────────
# 3. Page header with WebSocket status badge top-right
# ─────────────────────────────────────────────────────────────────────────────
_col_title, _col_ws = st.columns([8, 2])
with _col_title:
    st.title("👶 Baby Posture & Object Detection Simulator")
with _col_ws:
    st.markdown("<div style='padding-top:18px'></div>", unsafe_allow_html=True)
    if is_connected():
        st.markdown(
            "<span style='font-size:13px;color:#2ecc71'>●&nbsp;<b>WS&nbsp;Connected</b></span>",
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            "<span style='font-size:13px;color:#e74c3c'>●&nbsp;<b>WS&nbsp;Disconnected</b></span>",
            unsafe_allow_html=True,
        )
st.write("Use the tabs below to simulate sensor data, or analyse images, videos, and audio.")

# ─────────────────────────────────────────────────────────────────────────────
# 4. Cached model loaders (loaded once, shared across all tabs)
# ─────────────────────────────────────────────────────────────────────────────
@st.cache_resource
def get_posture_model():
    return load_posture_detection_model()

@st.cache_resource
def get_object_model():
    return load_object_detection_model()

@st.cache_resource
def get_cry_model():
    return load_yamnet_model()


posture_model             = get_posture_model()
object_model              = get_object_model()
cry_model, class_names    = get_cry_model()

# ─────────────────────────────────────────────────────────────────────────────
# 5. Main content — tabbed layout
# ─────────────────────────────────────────────────────────────────────────────
tab_sensor, tab_image, tab_video, tab_audio = st.tabs([
    "🔌 Sensor Simulator",
    "🖼️ Image Analysis",
    "🎬 Video Analysis",
    "🎵 Audio / Cry Detection",
])

with tab_sensor:
    sensor_tab.render()

with tab_image:
    image_tab.render(posture_model, object_model)

with tab_video:
    video_tab.render(posture_model, object_model, cry_model, class_names)

with tab_audio:
    audio_tab.render(cry_model, class_names)
