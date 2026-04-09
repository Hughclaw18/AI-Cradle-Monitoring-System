"""
components/tabs/audio_tab.py
Audio Analysis tab: WAV upload → cry detection → result display + WS send.
"""
import streamlit as st

from utils.inference import predict_cry
from components.websocket_manager import send_sensor_data


def render(cry_model, class_names) -> None:
    st.header("🎵 Audio / Cry Detection")
    st.caption("Tip: WAV works out-of-the-box. MP3/M4A requires FFmpeg shared libraries for TorchCodec.")

    uploaded = st.file_uploader("Upload an audio file…", type=["wav"])
    if uploaded is None:
        return

    st.write("Analysing cry pattern…")
    results = predict_cry(cry_model, uploaded, class_names=class_names)

    if "error" in results:
        st.error(f"Cry Detection Error: {results['error']}")
        err = str(results["error"]).lower()
        if "torchcodec" in err or "libtorchcodec" in err:
            st.info(
                "On Windows, install the FFmpeg shared build and ensure it is on PATH, "
                "then restart the simulator. Alternatively, upload a WAV file."
            )
        return

    st.audio(uploaded)

    is_crying  = results["is_crying"]
    confidence = results["confidence"]
    message    = results["message"]

    st.subheader("Cry Analysis Result")
    if is_crying:
        st.error(f"🚨 **{message}**")
    else:
        st.success(f"✅ {message}")

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Crying Detected", "Yes 😭" if is_crying else "No 😊")
    with col2:
        st.metric("Confidence", f"{confidence:.1%}" if isinstance(confidence, float) else str(confidence))

    # ── Send result to backend ────────────────────────────────────────────────
    # Use last known temperature from session state if available, else default to 75°F
    temperature = st.session_state.get("last_video_temp", 75.0)
    send_sensor_data(temperature=temperature, crying_detected=is_crying, object_detected_list=[])
    st.info("Cry detection status sent to dashboard.")
