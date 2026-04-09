"""
components/websocket_manager.py
All WebSocket connection and data-sending helpers.
"""
import json
import time
import streamlit as st
import websocket

from components.session import get_ws_url


# ── Connection helpers ────────────────────────────────────────────────────────

def connect_ws() -> bool:
    """Open a new WebSocket connection and persist it in session_state.
    Returns True on success."""
    ws_url     = get_ws_url()
    sim_token  = st.session_state.sim_token

    try:
        if st.session_state.cookies:
            cookie_str = "; ".join(
                [f"{k}={v}" for k, v in st.session_state.cookies.get_dict().items()]
            )
            st.session_state.ws = websocket.create_connection(ws_url, cookie=cookie_str)
        else:
            ws_url_with_token = f"{ws_url}?token={sim_token}"
            headers = {"x-simulator-token": sim_token}
            st.session_state.ws = websocket.create_connection(ws_url_with_token, header=headers)
        return True
    except Exception as exc:
        st.error(f"Failed to connect to WebSocket: {exc}")
        return False


def disconnect_ws() -> None:
    """Close the current WebSocket connection."""
    if st.session_state.ws:
        try:
            st.session_state.ws.close()
        except Exception:
            pass
        st.session_state.ws = None


def ensure_ws_connection() -> bool:
    """Auto-reconnect if the socket is missing or closed. Returns True if ready."""
    if st.session_state.ws is None or not st.session_state.ws.connected:
        return connect_ws()
    return True


def is_connected() -> bool:
    return bool(st.session_state.ws and st.session_state.ws.connected)


# ── Data sending ──────────────────────────────────────────────────────────────

def send_sensor_data(
    temperature: float,
    crying_detected: bool,
    object_detected_list: list,
    sleeping_position: str = "Unknown",
) -> None:
    """Build and send a sensor_update payload over the WebSocket.
    Automatically retries once on a dropped connection."""
    if not ensure_ws_connection():
        return

    payload = _build_sensor_payload(temperature, crying_detected, object_detected_list, sleeping_position)
    message  = json.dumps({"type": "sensor_update", "data": payload})

    try:
        st.session_state.ws.send(message)
        st.success(f"Sent sensor data: {message}")
    except (ConnectionResetError, websocket.WebSocketConnectionClosedException, OSError) as exc:
        st.warning("Connection lost during send — retrying once…")
        if ensure_ws_connection():
            try:
                st.session_state.ws.send(message)
                st.success("Resent sensor data after reconnect.")
                return
            except Exception as retry_exc:
                st.error(f"Retry failed: {retry_exc}")
        st.error(f"Connection lost: {exc}")
        st.session_state.ws = None
    except Exception as exc:
        st.error(f"Error sending data: {exc}")


def send_video_frame(b64_frame: str) -> None:
    """Send a base-64 encoded video frame over the WebSocket (best-effort)."""
    if not ensure_ws_connection():
        return
    try:
        msg = json.dumps({"type": "video_frame", "data": b64_frame})
        st.session_state.ws.send(msg)
    except Exception:
        pass  # Non-critical; drop silently for live video


# ── Private ───────────────────────────────────────────────────────────────────

def _build_sensor_payload(temperature, crying_detected, object_detected_list, sleeping_position="Unknown"):
    return {
        "sensor_id": st.session_state.username or "anonymous",
        "id": 1,
        "timestamp": time.time() * 1000,
        "temperature": temperature,
        "cryingDetected": crying_detected,
        "sleepingPosition": sleeping_position,
        "objectDetected": [
            {"object_name": obj, "timestamp": time.time() * 1000}
            for obj in object_detected_list
        ],
    }
