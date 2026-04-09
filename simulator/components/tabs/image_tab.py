"""
components/tabs/image_tab.py
Image Analysis tab: upload → posture + object detection → summary + WS send.
"""
import streamlit as st
from PIL import Image

from utils.inference import predict_posture, predict_object
from components.websocket_manager import send_sensor_data, is_connected


def render(posture_model, object_model) -> None:
    st.header("🖼️ Image Analysis")
    st.write("Upload an image to detect the baby's posture and nearby objects simultaneously.")

    uploaded = st.file_uploader("Upload an image…", type=["jpg", "jpeg", "png"])
    if uploaded is None:
        return

    st.write("Analysing…")
    posture_results = predict_posture(posture_model, uploaded)
    object_results  = predict_object(object_model, uploaded)

    # ── Error handling ────────────────────────────────────────────────────────
    if "error" in posture_results:
        st.error(f"Posture Detection Error: {posture_results['error']}")
    if "error" in object_results:
        st.error(f"Object Detection Error: {object_results['error']}")

    if "error" in posture_results or "error" in object_results:
        return

    # ── Side-by-side images ───────────────────────────────────────────────────
    col_orig, col_posture, col_object = st.columns(3)

    with col_orig:
        st.subheader("Original")
        st.image(uploaded, caption="Uploaded Image", use_container_width=True)

    with col_posture:
        st.subheader("Posture Detection")
        img = posture_results.get("output_image")
        if isinstance(img, Image.Image):
            st.image(img, caption="Posture Output", use_container_width=True)
        else:
            st.warning("Posture output image unavailable.")

    with col_object:
        st.subheader("Object Detection")
        img = object_results.get("output_image")
        if isinstance(img, Image.Image):
            st.image(img, caption="Object Output", use_container_width=True)
        else:
            st.warning("Object output image unavailable.")

    # ── Summary ───────────────────────────────────────────────────────────────
    st.divider()
    st.subheader("Analysis Summary")
    st.write(f"**Posture:** {posture_results['posture']}")
    if posture_results.get("posture_danger"):
        st.warning("⚠️ **Airway Risk:** Baby is on stomach with head turned — monitor closely.")

    detected  = object_results.get("detected_objects", [])
    hazardous = object_results.get("hazardous_objects", [])
    st.write(f"**Objects Detected:** {', '.join(detected) if detected else 'None'}")

    if hazardous:
        st.error(f"🚨 **DANGER! Hazardous objects: {', '.join(hazardous)}**")
    else:
        st.success("✅ No hazardous objects detected.")

    # ── WebSocket send ────────────────────────────────────────────────────────
    # Send actual object names so the mobile app can display and alert on them correctly.
    # Prioritise hazardous objects; fall back to all detected objects.
    objects_to_send = list(hazardous) if hazardous else list(detected)

    # Treat posture_danger (baby on stomach) as a crying-level alert so the
    # backend broadcasts a notification to the mobile app.
    posture_danger = posture_results.get("posture_danger", False)

    send_sensor_data(
        temperature=75.0,
        crying_detected=posture_danger,   # triggers backend alert for airway risk
        object_detected_list=objects_to_send,
        sleeping_position=posture_results.get("posture", "Unknown"),
    )

    if posture_danger:
        st.warning("⚠️ Posture danger alert sent to dashboard.")
