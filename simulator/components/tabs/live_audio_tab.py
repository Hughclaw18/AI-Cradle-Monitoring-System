"""
components/tabs/live_audio_tab.py
Live Microphone Cry Detection tab.

Fix: background thread never touches st.session_state.
     A plain threading.Event controls start/stop instead.
"""
import time
import threading
import queue

import numpy as np
import streamlit as st

from components.websocket_manager import send_sensor_data, is_connected

SAMPLE_RATE   = 16_000
WINDOW_SEC    = 1.0
CRY_THRESHOLD = 0.30
SEND_COOLDOWN = 3.0

# ── Module-level primitives (no session_state in threads) ─────────────────────
_stop_event   = threading.Event()   # set() → thread exits
_result_queue: queue.Queue = queue.Queue(maxsize=20)
_thread: threading.Thread | None = None


def render(cry_model, class_names) -> None:
    st.header("🎙️ Live Mic — Real-time Cry Detection")
    st.caption(
        "Captures audio from the simulator machine's microphone and runs "
        "YAMNet cry detection in real-time."
    )

    if cry_model is None:
        st.error("Cry detection model not loaded. Cannot start live detection.")
        return

    # ── Device picker ─────────────────────────────────────────────────────────
    try:
        import sounddevice as sd
        devices    = sd.query_devices()
        input_devs = [(i, d["name"]) for i, d in enumerate(devices) if d["max_input_channels"] > 0]
    except Exception as e:
        st.error(f"sounddevice error: {e}")
        return

    if not input_devs:
        st.warning("No microphone devices found.")
        return

    dev_labels = [f"{i}: {name}" for i, name in input_devs]
    selected   = st.selectbox("Microphone", dev_labels, key="live_mic_device")
    device_idx = int(selected.split(":")[0])

    st.divider()

    # ── Status placeholders ───────────────────────────────────────────────────
    col_status, col_conf = st.columns(2)
    status_ph = col_status.empty()
    conf_ph   = col_conf.empty()
    bar_ph    = st.empty()
    log_ph    = st.empty()

    # ── Running flag stored in session_state (UI thread only) ─────────────────
    if "live_mic_running" not in st.session_state:
        st.session_state.live_mic_running = False

    # Capture last_video_temp NOW in the UI thread so the thread can use it
    last_temp = st.session_state.get("last_video_temp", 75.0)

    col_start, col_stop = st.columns(2)

    with col_start:
        if st.button("▶ Start", use_container_width=True,
                     disabled=st.session_state.live_mic_running):
            _start(cry_model, class_names, device_idx, last_temp)
            st.session_state.live_mic_running = True
            st.rerun()

    with col_stop:
        if st.button("⏹ Stop", use_container_width=True,
                     disabled=not st.session_state.live_mic_running):
            _stop()
            st.session_state.live_mic_running = False
            st.rerun()

    # ── Poll results ──────────────────────────────────────────────────────────
    if st.session_state.live_mic_running:
        # Check thread is still alive; auto-stop if it died
        if _thread is not None and not _thread.is_alive():
            st.session_state.live_mic_running = False
            st.warning("Mic thread stopped unexpectedly.")
            st.rerun()

        st.info("🔴 Listening… (updates every second)")

        latest = None
        while not _result_queue.empty():
            try:
                latest = _result_queue.get_nowait()
            except queue.Empty:
                break

        if latest:
            if "error" in latest:
                log_ph.warning(f"Thread error: {latest['error']}")
            else:
                is_crying  = latest["is_crying"]
                confidence = latest["confidence"]
                top_class  = latest.get("top_class", "")
                top5       = latest.get("top5", [])
                ts         = latest.get("timestamp", "")

                if is_crying:
                    status_ph.error("😭 **Crying Detected!**")
                else:
                    status_ph.success("🔇 No crying")

                conf_ph.metric("Baby Cry Confidence", f"{confidence:.1%}")
                bar_ph.progress(min(int(confidence * 100), 100))

                # Top-5 breakdown table
                if top5:
                    import pandas as pd
                    df = pd.DataFrame(top5)
                    df["confidence"] = df["confidence"].map(lambda x: f"{x:.3f}")
                    df.index = df.index + 1
                    df.columns = ["Sound Class", "Confidence"]
                    log_ph.markdown(f"**Top-5 detected sounds** _{ts}_")
                    log_ph.dataframe(df, use_container_width=True, hide_index=False)

        time.sleep(1)
        st.rerun()
    else:
        status_ph.info("Press ▶ Start to begin live detection.")


# ── Thread management (module-level, no session_state) ────────────────────────

def _start(cry_model, class_names, device_idx: int, last_temp: float) -> None:
    global _thread
    _stop_event.clear()
    # Drain stale results
    while not _result_queue.empty():
        try:
            _result_queue.get_nowait()
        except queue.Empty:
            break
    _thread = threading.Thread(
        target=_capture_loop,
        args=(cry_model, class_names, device_idx, last_temp),
        daemon=True,
        name="live-mic-capture",
    )
    _thread.start()


def _stop() -> None:
    _stop_event.set()


def _capture_loop(cry_model, class_names, device_idx: int, last_temp: float) -> None:
    """
    Pure Python — zero access to st.session_state.
    Reads _stop_event to know when to exit.
    """
    import sounddevice as sd

    cry_idx = 14
    if class_names:
        try:
            cry_idx = class_names.index("Baby cry, infant cry")
        except ValueError:
            pass

    last_send_time = 0.0
    samples_needed = int(SAMPLE_RATE * WINDOW_SEC)

    while not _stop_event.is_set():
        try:
            audio = sd.rec(
                samples_needed,
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="float32",
                device=device_idx,
            )
            sd.wait()

            waveform = audio.flatten()
            peak = np.max(np.abs(waveform))
            if peak > 0:
                waveform = waveform / peak

            scores, _emb, _spec = cry_model(waveform)
            scores_np   = scores.numpy()
            mean_scores = scores_np.mean(axis=0)

            baby_conf = float(mean_scores[cry_idx])
            top_idx   = int(mean_scores.argmax())
            top_class = class_names[top_idx] if class_names else ""
            top_conf  = float(mean_scores[top_idx])
            is_crying = baby_conf >= CRY_THRESHOLD

            # Build top-5 classes for logging / display
            top5_idx   = mean_scores.argsort()[-5:][::-1]
            top5       = [
                {"class": class_names[i] if class_names else str(i),
                 "confidence": float(mean_scores[i])}
                for i in top5_idx
            ]

            # Console log — always printed so it appears in the terminal
            ts = time.strftime("%H:%M:%S")
            if is_crying:
                print(f"[{ts}] 😭 CRY DETECTED  baby_cry_conf={baby_conf:.3f}")
            else:
                print(f"[{ts}] 🔇 No cry         baby_cry_conf={baby_conf:.3f}")
            for rank, entry in enumerate(top5, 1):
                print(f"       #{rank}  {entry['class']:<40}  {entry['confidence']:.3f}")

            result = {
                "is_crying":  is_crying,
                "confidence": baby_conf,
                "top_class":  f"{top_class} ({top_conf:.2f})",
                "top5":       top5,
                "timestamp":  ts,
            }

            if _result_queue.full():
                try:
                    _result_queue.get_nowait()
                except queue.Empty:
                    pass
            _result_queue.put_nowait(result)

            # WebSocket send — uses module-level is_connected(), no session_state
            now = time.time()
            if is_crying and (now - last_send_time) >= SEND_COOLDOWN:
                if is_connected():
                    send_sensor_data(
                        temperature=last_temp,
                        crying_detected=True,
                        object_detected_list=[],
                    )
                    last_send_time = now

        except Exception as e:
            try:
                _result_queue.put_nowait({"error": str(e)})
            except queue.Full:
                pass
            time.sleep(1)
