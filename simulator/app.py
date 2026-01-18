import streamlit as st
import os
import numpy as np
from PIL import Image # Import Image for displaying PIL objects
import websocket
import json
import time
from utils.model_loader import load_cry_detection_model, load_object_detection_model, load_posture_detection_model
from utils.inference import predict_cry, predict_object, process_video_for_detection, predict_posture

# Set page config
st.set_page_config(page_title="Baby Posture Detection", layout="wide")

# Define the WebSocket server URL
WEBSOCKET_URL = "ws://127.0.0.1:3000/ws"

# Title
st.title("👶 Baby Posture and Object Detection")

# Pre-load models into cache (messages removed as per user request)
_ = load_posture_detection_model("simulator/models/best.pt")
_ = load_object_detection_model("simulator/models/yoloe-11s-seg.pt")
_ = load_cry_detection_model("models/cry_detection_yoloe.pt")

st.header("Image and Video Analysis (Posture & Object Detection)")
st.write("Upload an image or video to detect the baby's posture and objects around the baby simultaneously.")

# Models are already loaded and cached, no need to load again here
posture_model = load_posture_detection_model("simulator/models/best.pt")
object_model = load_object_detection_model("simulator/models/yoloe-11s-seg.pt")

# Function to send sensor data
def send_sensor_data(ws, temperature, crying_detected, object_detected_list):
    try:
        sensor_data = {
            "id": 1,
            "timestamp": time.time() * 1000,
            "temperature": temperature,
            "cryingDetected": crying_detected,
            "objectDetected": [{"object_name": obj, "timestamp": time.time() * 1000} for obj in object_detected_list]
        }

        message = {
            "type": "sensor_update",
            "data": sensor_data
        }

        ws.send(json.dumps(message))
        st.success(f"Sent sensor data: {json.dumps(sensor_data)}")
    except Exception as e:
        st.error(f"Error sending data: {e}")

# WebSocket connection management
if 'ws' not in st.session_state:
    st.session_state.ws = None
if 'frame_counter' not in st.session_state:
    st.session_state.frame_counter = 0 # Initialize frame counter
SEND_INTERVAL_FRAMES = 10 # Send data every 10 frames

st.subheader("WebSocket Connection")
col_ws1, col_ws2 = st.columns(2)

with col_ws1:
    if st.button("Connect to WebSocket", key="connect_ws"):
        if st.session_state.ws and st.session_state.ws.connected:
            st.warning("Already connected to WebSocket.")
        else:
            try:
                st.session_state.ws = websocket.create_connection(WEBSOCKET_URL)
                st.success(f"Connected to WebSocket at {WEBSOCKET_URL}")
            except Exception as e:
                st.error(f"Failed to connect to WebSocket: {e}")

with col_ws2:
    if st.button("Disconnect from WebSocket", key="disconnect_ws"):
        if st.session_state.ws:
            st.session_state.ws.close()
            st.session_state.ws = None
            st.success("Disconnected from WebSocket.")
        else:
            st.warning("Not connected to WebSocket.")

file_type = st.radio("Select input type", ["Image", "Video"])

if file_type == "Image":
    uploaded_file = st.file_uploader("Upload an image...", type=["jpg", "jpeg", "png"])
    if uploaded_file is not None:
            st.write("Performing posture and object detection...")

            # Perform inference for both models
            posture_results = predict_posture(posture_model, uploaded_file)
            object_results = predict_object(object_model, uploaded_file)

            if "error" in posture_results:
                st.error(f"Posture Detection Error: {posture_results['error']}")
            if "error" in object_results:
                st.error(f"Object Detection Error: {object_results['error']}")

            if "error" not in posture_results and "error" not in object_results:
                col1, col2, col3 = st.columns(3)

                with col1:
                    st.subheader("Original")
                    st.image(uploaded_file, caption="Uploaded Image", use_container_width=True)
                
                with col2:
                    st.subheader("Posture Detection")
                    if "output_image" in posture_results and isinstance(posture_results["output_image"], Image.Image):
                        st.image(posture_results["output_image"], caption="Posture Detection Output", use_container_width=True)
                    else:
                        st.warning("Posture detection output image not available.")

                with col3:
                    st.subheader("Object Detection")
                    if "output_image" in object_results and isinstance(object_results["output_image"], Image.Image):
                        st.image(object_results["output_image"], caption="Object Detection Output", use_container_width=True)
                    else:
                        st.warning("Object detection output image not available.")
                
                st.markdown("---") # Separator
                st.subheader("Analysis Summary:")
                st.write(f"**Posture Status:** {posture_results['posture']}")
                st.write(f"**Objects Detected:** {', '.join(object_results['detected_objects']) if object_results['detected_objects'] else 'None'}")

                if object_results["hazardous_objects"]:
                    st.error(f"🚨 **DANGER! Hazardous objects detected near baby: {', '.join(object_results['hazardous_objects'])}!**")
                else:
                    st.success("✅ Baby is in a normal status. No hazardous objects detected.")
                
                st.success("Image analysis complete!")

                # Prepare and send sensor data via WebSocket (for images, send immediately if connected)
                if st.session_state.ws and st.session_state.ws.connected:
                    temperature = 75.0 # Default temperature for image analysis
                    crying_detected = False # Assuming no crying detection from image for now
                    
                    # Determine object status message
                    object_status_message = ""
                    if object_results["hazardous_objects"]:
                        object_status_message = f"DANGER: Hazardous objects detected: {', '.join(object_results['hazardous_objects'])}"
                    else:
                        object_status_message = "SAFE: No hazardous objects detected."

                    # Send only the object status message in the objectDetected list
                    send_sensor_data(st.session_state.ws, temperature, crying_detected, [object_status_message])
                else:
                    st.warning("Connect to WebSocket to send sensor data.")

elif file_type == "Video":
    uploaded_file = st.file_uploader("Upload a video...", type=["mp4", "avi", "mov"])
    if uploaded_file is not None:
        st.write("Performing posture and object detection in video...")
        
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Original Video")
            st.video(uploaded_file)
        
        with col2:
            st.subheader("Live Processed Video (Posture & Object Detection)")
            live_video_placeholder = st.empty()
        
        st.markdown("---") # Separator
        st.subheader("Analysis Summary (Video):")
        posture_summary_placeholder = st.empty()
        objects_detected_placeholder = st.empty()
        hazardous_objects_placeholder = st.empty()
        status_message_placeholder = st.empty()

        final_video_path = None
        all_detected_objects_overall = set()
        all_hazardous_objects_overall = set()
        posture_summary_overall = "Unknown"

        st.session_state.frame_counter = 0 # Reset counter for new video upload

        try:
            for yielded_item in process_video_for_detection(posture_model, object_model, uploaded_file):
                if isinstance(yielded_item, dict):
                    if "error" in yielded_item:
                        st.error(f"Video Processing Error: {yielded_item['error']}")
                        break
                    else: # This is the final summary dictionary
                        final_video_path = yielded_item["output_video_path"]
                        all_detected_objects_overall = set(yielded_item["all_detected_objects"])
                        all_hazardous_objects_overall = set(yielded_item["all_hazardous_objects"])
                        posture_summary_overall = yielded_item["posture_summary"]
                        status_message_placeholder.success("Video analysis complete!")
                        break # Exit loop after receiving final summary
                else: # This is a yielded frame and its per-frame results (a tuple)
                    frame, current_posture, current_frame_objects, current_frame_hazardous_objects = yielded_item
                    live_video_placeholder.image(frame, channels="BGR", use_container_width=True)
                    
                    posture_summary_placeholder.write(f"**Posture Status (Current Frame):** {current_posture}")
                    objects_detected_placeholder.write(f"**Objects Detected (Current Frame):** {', '.join(current_frame_objects) if current_frame_objects else 'None'}")
                    
                    if current_frame_hazardous_objects:
                        hazardous_objects_placeholder.error(f"🚨 **DANGER! Hazardous objects detected (Current Frame): {', '.join(current_frame_hazardous_objects)}!**")
                    else:
                        hazardous_objects_placeholder.success("✅ No hazardous objects detected (Current Frame).")
                    
                    all_detected_objects_overall.update(current_frame_objects)
                    all_hazardous_objects_overall.update(current_frame_hazardous_objects)
                    if posture_summary_overall == "Unknown": # Update only if not set by a more specific posture
                        posture_summary_overall = current_posture

                    # Send sensor data for the current frame based on interval or danger
                    st.session_state.frame_counter += 1
                    if st.session_state.ws and st.session_state.ws.connected:
                        should_send = False
                        if current_frame_hazardous_objects: # Always send if danger is detected
                            should_send = True
                        elif st.session_state.frame_counter % SEND_INTERVAL_FRAMES == 0: # Send periodically if no danger
                            should_send = True

                        if should_send:
                            temperature = round(np.random.uniform(70.0, 85.0), 2) # Simulate temperature for video
                            crying_detected = bool(np.random.choice([True, False])) # Cast to Python bool
                            
                            # Determine object status message
                            object_status_message = ""
                            if current_frame_hazardous_objects:
                                object_status_message = f"DANGER: Hazardous objects detected: {', '.join(current_frame_hazardous_objects)}"
                            else:
                                object_status_message = "SAFE: No hazardous objects detected."

                            # Send only the object status message in the objectDetected list
                            send_sensor_data(st.session_state.ws, temperature, crying_detected, [object_status_message])
                            st.session_state.frame_counter = 0 # Reset counter after sending

            if final_video_path:
                st.subheader("Processed Video (Full)")
                st.video(final_video_path)
                
                st.markdown("---") # Separator
                st.subheader("Overall Analysis Summary (Video):")
                st.write(f"**Overall Posture Status:** {posture_summary_overall}")
                st.write(f"**Overall Objects Detected:** {', '.join(all_detected_objects_overall) if all_detected_objects_overall else 'None'}")

                if all_hazardous_objects_overall:
                    st.error(f"🚨 **DANGER! Overall Hazardous objects detected in video: {', '.join(all_hazardous_objects_overall)}!**")
                else:
                    st.success("✅ Baby is in a normal status. No hazardous objects detected in video.")

        finally:
            # Clean up temporary output video file
            if final_video_path and os.path.exists(final_video_path):
                os.remove(final_video_path)
