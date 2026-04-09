"""
components/tabs/sensor_tab.py
Sensor Data Simulator tab: manual send, cry notification, auto-send.
"""
import threading
import numpy as np
import streamlit as st

from components.websocket_manager import is_connected, send_sensor_data


OBJECT_OPTIONS = [
    "knife", "toy", "insect", "bottle", "blanket", "pacifier",
    "scissors", "lighter", "coin", "battery", "pin", "nail",
    "glass", "medicine", "plastic_bag", "small_marble", "sharp_toy", "hot_liquid",
]


def _auto_send_loop(stop_event: threading.Event) -> None:
    """Background thread: sends random sensor data every 5 seconds until stopped."""
    import time
    while not stop_event.wait(5):
        if is_connected():
            rand_temp    = round(np.random.uniform(70.0, 85.0), 2)
            rand_crying  = bool(np.random.choice([True, False]))
            rand_objects = (
                [np.random.choice(["toy", "bottle", "blanket"])]
                if np.random.random() < 0.3
                else []
            )
            try:
                send_sensor_data(rand_temp, rand_crying, rand_objects)
            except Exception:
                pass  # Don't crash the background thread


def render() -> None:
    st.header("🔌 Sensor Data Simulator")

    # ── Connection status badge ───────────────────────────────────────────
    connected = is_connected()
    if connected:
        st.success("🟢 WebSocket connected")
    else:
        st.warning("🔴 WebSocket disconnected — please log in to connect automatically.")
    st.divider()

    # ── Sensor inputs ─────────────────────────────────────────────────────────
    st.subheader("Sensor Data Inputs")
    temperature = st.slider("Temperature (°F)", min_value=60.0, max_value=100.0, value=75.0, step=0.1)
    crying      = st.checkbox("Crying Detected", value=False)
    objects     = st.multiselect("Objects Detected", OBJECT_OPTIONS, default=[])

    col_send, col_cry = st.columns(2)

    with col_send:
        if st.button("📤 Send Sensor Data", use_container_width=True):
            if is_connected():
                send_sensor_data(temperature, crying, objects)
            else:
                st.warning("Connect to WebSocket first.")

    with col_cry:
        if st.button("😭 Send Cry Notification", use_container_width=True):
            if is_connected():
                send_sensor_data(temperature, True, objects)
            else:
                st.warning("Connect to WebSocket first.")

    st.divider()

    # ── Auto-send ─────────────────────────────────────────────────────────────
    st.subheader("⚡ Auto-send Random Data")
    auto_enabled = st.checkbox("Enable auto-send every 5 seconds")

    thread_alive = (
        "auto_send_thread" in st.session_state
        and st.session_state.auto_send_thread is not None
        and st.session_state.auto_send_thread.is_alive()
    )

    if auto_enabled and not thread_alive:
        # Start background thread — UI stays fully responsive
        stop_event = threading.Event()
        st.session_state.auto_send_stop   = stop_event
        st.session_state.auto_send_thread = threading.Thread(
            target=_auto_send_loop, args=(stop_event,), daemon=True
        )
        st.session_state.auto_send_thread.start()
        st.info("Auto-send started — random sensor data sent every 5 seconds in the background.")

    elif not auto_enabled and thread_alive:
        # Stop the background thread
        st.session_state.auto_send_stop.set()
        st.session_state.auto_send_thread = None
        st.info("Auto-send stopped.")

    elif auto_enabled and thread_alive:
        st.info("Auto-send is running — random sensor data sent every 5 seconds.")

    if not connected and auto_enabled:
        st.warning("WebSocket not connected — log in to connect automatically.")
