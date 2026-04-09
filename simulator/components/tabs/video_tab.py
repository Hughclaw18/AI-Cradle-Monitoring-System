"""
components/tabs/video_tab.py
Video Analysis tab: frame-by-frame detection, live preview, WS streaming, summary.
"""
import os
import base64
import time

import cv2
import numpy as np
import streamlit as st

from config import WIDTH, HEIGHT, JPEG_QUALITY, SEND_INTERVAL_FRAMES, VIDEO_SEND_INTERVAL_FRAMES, SUMMARY_UPDATE_INTERVAL
from utils.inference import process_video_for_detection
from components.websocket_manager import send_sensor_data, send_video_frame, ensure_ws_connection


def render(posture_model, object_model, cry_model=None, class_names=None) -> None:
    st.header("🎬 Video Analysis")
    st.write("Upload a video to run frame-by-frame posture and object detection.")

    uploaded = st.file_uploader("Upload a video…", type=["mp4", "avi", "mov"])
    if uploaded is None:
        return

    st.write("Processing video…")

    col_orig, col_live = st.columns(2)
    with col_orig:
        st.subheader("Original Video")
        st.video(uploaded)
    with col_live:
        st.subheader("Live Detection Feed")
        live_placeholder = st.empty()

    st.divider()
    st.subheader("Real-time Analysis Summary")
    posture_ph   = st.empty()
    objects_ph   = st.empty()
    hazardous_ph = st.empty()
    cry_ph       = st.empty()
    status_ph    = st.empty()

    # Reset frame counters for this upload
    st.session_state.frame_counter       = 0
    st.session_state.video_frame_counter = 0

    final_video_path          = None
    all_detected_objects      = set()
    all_hazardous_objects     = set()
    posture_summary           = "Unknown"
    last_summary_update       = 0.0   # timestamp of last status badge refresh

    try:
        for item in process_video_for_detection(
            posture_model, object_model, uploaded,
            cry_model=cry_model, class_names=class_names
        ):
            if isinstance(item, dict):
                # Final summary dict yielded by the generator
                if "error" in item:
                    st.error(f"Video Processing Error: {item['error']}")
                    break
                final_video_path      = item["output_video_path"]
                all_detected_objects  = set(item["all_detected_objects"])
                all_hazardous_objects = set(item["all_hazardous_objects"])
                posture_summary       = item["posture_summary"]
                audio_ok              = item.get("audio_available", False)
                status_ph.success("✅ Video analysis complete!")
                if not audio_ok:
                    st.warning("🔇 **Audio extraction failed** — cry detection was skipped. "
                               "Ensure FFmpeg is installed and on PATH, or check the configured FFmpeg path in config.py.")
                break
            else:
                # Per-frame tuple: (frame, posture, objects, hazardous, crying_flag)
                frame, cur_posture, cur_objects, cur_hazardous, crying_flag = item

                # Live frame preview — updates every yielded frame
                live_placeholder.image(frame, channels="BGR", use_container_width=True)

                # Stream frame to backend on interval
                st.session_state.video_frame_counter += 1
                if st.session_state.video_frame_counter % VIDEO_SEND_INTERVAL_FRAMES == 0:
                    if ensure_ws_connection():
                        resized = cv2.resize(frame, (WIDTH, HEIGHT))
                        _, buf   = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                        b64      = base64.b64encode(buf).decode("utf-8")
                        send_video_frame(b64)

                # Update status badges only on time-based cooldown
                now = time.time()
                if now - last_summary_update >= SUMMARY_UPDATE_INTERVAL:
                    last_summary_update = now
                    posture_ph.write(f"**Posture:** {cur_posture}")
                    objects_ph.write(f"**Objects:** {', '.join(cur_objects) if cur_objects else 'None'}")

                    if crying_flag:
                        cry_ph.error("😭 **Crying detected in audio!**")
                    else:
                        cry_ph.success("🔇 No crying detected.")

                    if cur_hazardous:
                        hazardous_ph.error(f"🚨 Hazardous objects: {', '.join(cur_hazardous)}")
                    else:
                        hazardous_ph.success("✅ No hazardous objects.")

                all_detected_objects.update(cur_objects)
                all_hazardous_objects.update(cur_hazardous)
                if posture_summary == "Unknown":
                    posture_summary = cur_posture

                # Send sensor data on interval or on danger
                st.session_state.frame_counter += 1
                should_send = bool(cur_hazardous) or (
                    st.session_state.frame_counter % SEND_INTERVAL_FRAMES == 0
                )

                if should_send:
                    # Simulate a realistic slowly-drifting temperature instead of pure random
                    prev_temp = st.session_state.get("last_video_temp", 75.0)
                    temperature = round(prev_temp + np.random.uniform(-0.3, 0.3), 2)
                    temperature = max(70.0, min(85.0, temperature))
                    st.session_state.last_video_temp = temperature

                    # Send actual object names so the mobile app can display/alert correctly
                    objects_to_send = list(cur_hazardous) if cur_hazardous else list(cur_objects)

                    send_sensor_data(
                        temperature,
                        bool(crying_flag),
                        objects_to_send,
                        sleeping_position=cur_posture,
                    )
                    st.session_state.frame_counter = 0

        # ── Overall summary after processing ─────────────────────────────────
        if final_video_path:
            st.divider()
            st.subheader("Processed Video (Full)")
            st.video(final_video_path)

            st.subheader("Overall Analysis Summary")
            st.write(f"**Overall Posture:** {posture_summary}")
            st.write(
                f"**Overall Objects Detected:** "
                f"{', '.join(all_detected_objects) if all_detected_objects else 'None'}"
            )

            if all_hazardous_objects:
                st.error(f"🚨 **DANGER! Overall hazardous objects: {', '.join(all_hazardous_objects)}**")
            else:
                st.success("✅ Baby is in a normal status. No hazardous objects in video.")

    finally:
        if final_video_path and os.path.exists(final_video_path):
            os.remove(final_video_path)
