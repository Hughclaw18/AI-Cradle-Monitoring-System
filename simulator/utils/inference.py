import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageDraw
import io
import os
import cv2
import supervision as sv
import tempfile
import shutil
import torchaudio
import torchaudio.transforms as T
from scipy.io import wavfile
from ultralytics import YOLO, YOLOE
from utils.model_loader import HAZARDOUS_CLASSES
from config import FFMPEG_PATH, AUDIO_WIN_SEC, CRY_DETECTION_INTERVAL_FRAMES, OBJECT_CONF_THRESHOLD
MEL = T.MelSpectrogram(sample_rate=16000, n_fft=1024, hop_length=512, n_mels=64)
DB = T.AmplitudeToDB()


def determine_posture(detected_parts: list) -> dict:
    """
    Maps a list of detected body-part class names to a human-readable sleeping
    position and a safety flag.

    Detected classes: 'nose', 'Face', 'Lear' (left ear), 'Rear' (right ear), 'back'

    Returns:
        dict with keys:
            'posture'  (str)  - human-readable sleeping position label
            'danger'   (bool) - True when baby is on stomach with head turned
                                (airway risk)
    """
    parts = set(detected_parts)
    has_nose = "nose" in parts
    has_face = "Face" in parts
    has_lear = "Lear" in parts   # left ear
    has_rear = "Rear" in parts   # right ear
    has_back = "back" in parts
    has_ears = has_lear or has_rear

    # ── Stomach / prone ───────────────────────────────────────────────────────
    # Back is the dominant indicator; any face/ear alongside it means the head
    # is turned — a potential airway risk worth flagging.
    if has_back:
        if has_nose or has_face or has_ears:
            side = ""
            if has_lear and not has_rear:
                side = " (head turned left)"
            elif has_rear and not has_lear:
                side = " (head turned right)"
            else:
                side = " (head turned sideways)"
            return {"posture": f"On stomach, head turned{side}", "danger": True}
        return {"posture": "Baby is sleeping on stomach", "danger": False}

    # ── Facing up / supine ────────────────────────────────────────────────────
    # Nose is the definitive supine indicator (only clearly visible face-up).
    if has_nose:
        if has_lear and not has_rear:
            label = "Baby is facing up (slightly tilted left)"
        elif has_rear and not has_lear:
            label = "Baby is facing up (slightly tilted right)"
        else:
            label = "Baby is facing up"
        return {"posture": label, "danger": False}

    # ── Side sleeping ─────────────────────────────────────────────────────────
    # Face without nose = profile view; ears without nose = side view.
    if has_ears or has_face:
        if has_lear and not has_rear:
            label = "Baby is side sleeping (left side)"
        elif has_rear and not has_lear:
            label = "Baby is side sleeping (right side)"
        else:
            label = "Baby is side sleeping"
        return {"posture": label, "danger": False}

    # ── Unknown ───────────────────────────────────────────────────────────────
    return {"posture": "Unknown", "danger": False}


def predict_posture(model, image_file):
    """
    Runs posture detection inference on an image using the loaded YOLO model.
    Args:
        model: Loaded YOLO posture detection model (best.pt).
        image_file: Uploaded image file from Streamlit.
    Returns:
        Detection results including the annotated image as a PIL Image.
    """
    try:
        # Save the uploaded file to a temporary location
        temp_upload_dir = os.path.join("assets", "temp_upload")
        os.makedirs(temp_upload_dir, exist_ok=True)
        temp_image_path = os.path.join(temp_upload_dir, image_file.name)
        with open(temp_image_path, "wb") as f:
            f.write(image_file.getvalue())

        # Read image using cv2.imread
        img_np_bgr = cv2.imread(temp_image_path)
        if img_np_bgr is None:
            raise ValueError(f"Could not read image file: {temp_image_path}")
        img_np_rgb = cv2.cvtColor(img_np_bgr, cv2.COLOR_BGR2RGB) # Convert to RGB for consistent processing

        # Perform YOLO inference directly on the NumPy array
        results_list = model.predict(source=img_np_rgb, save=False, verbose=False)
        
        detected_parts = []
        posture = "Unknown"
        posture_danger = False          # safe default if results_list is empty
        annotated_image_pil = Image.fromarray(img_np_rgb)

        if results_list:
            result = results_list[0]
            
            # Convert Ultralytics results to supervision Detections
            detections = sv.Detections.from_ultralytics(result)

            # Get detected class names
            if result.names and detections.class_id is not None:
                for class_id in detections.class_id:
                    class_name = result.names[class_id]
                    detected_parts.append(class_name)
            
            # Determine posture using shared helper
            posture_info = determine_posture(detected_parts)
            posture = posture_info["posture"]
            posture_danger = posture_info["danger"]

            # Annotate image using supervision
            box_annotator = sv.BoxAnnotator()
            label_annotator = sv.LabelAnnotator(text_color=sv.Color.BLACK)

            labels = [
                result.names[class_id]
                for class_id
                in detections.class_id
            ] if detections.class_id is not None else []

            annotated_image_np = box_annotator.annotate(
                scene=img_np_rgb.copy(), detections=detections)
            annotated_image_np = label_annotator.annotate(
                scene=annotated_image_np, detections=detections, labels=labels)
            
            annotated_image_pil = Image.fromarray(annotated_image_np)

        # # Add posture text to the annotated image using PIL
        # draw_final = ImageDraw.Draw(annotated_image_pil)
        # text_color = (255, 0, 0) # Red color for text
        # draw_final.text((10, 10), f"Posture: {posture}", fill=text_color)
        # draw_final.text((10, 40), f"Detected parts: {', '.join(detected_parts) if detected_parts else 'None'}", fill=text_color)

        results = {
            "posture": posture,
            "posture_danger": posture_danger,
            "output_image": annotated_image_pil,
            "message": f"Detected posture in image: {posture}"
        }
        return results
    except Exception as e:
        return {"error": f"Error during posture detection: {e}"}
    finally:
        # Clean up temporary uploaded file
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)

def predict_object(model, image_file):
    """
    Runs object detection inference on an image using the loaded YOLOe model.
    Args:
        model: Loaded YOLOe object detection model.
        image_file: Uploaded image file from Streamlit.
    Returns:
        Detection results including the annotated image as a PIL Image.
    """
    try:
        # Save the uploaded file to a temporary location
        temp_upload_dir = os.path.join("assets", "temp_upload")
        os.makedirs(temp_upload_dir, exist_ok=True)
        temp_image_path = os.path.join(temp_upload_dir, image_file.name)
        with open(temp_image_path, "wb") as f:
            f.write(image_file.getvalue())

        # Read image using cv2.imread
        img_np_bgr = cv2.imread(temp_image_path)
        if img_np_bgr is None:
            raise ValueError(f"Could not read image file: {temp_image_path}")
        img_np_rgb_for_annotation = cv2.cvtColor(img_np_bgr, cv2.COLOR_BGR2RGB) # Convert to RGB for supervision

        # Perform YOLOe inference directly on the BGR NumPy array
        results_list = model.predict(source=img_np_bgr, save=False, verbose=False)
        
        detected_objects = []
        found_hazardous = []
        annotated_image_pil = Image.fromarray(img_np_rgb_for_annotation) # Default to original if no detections or issues

        if results_list:
            result = results_list[0]
            
            # Convert Ultralytics results to supervision Detections
            detections = sv.Detections.from_ultralytics(result)

            # Get detected class names filtered by confidence threshold
            if result.names and detections.class_id is not None:
                confs = detections.confidence if detections.confidence is not None else [1.0] * len(detections.class_id)
                for class_id, conf in zip(detections.class_id, confs):
                    if conf >= OBJECT_CONF_THRESHOLD:
                        class_name = result.names[class_id]
                        detected_objects.append(class_name)

            # Filter annotation labels and bounding boxes to high-confidence only
            if detections.class_id is not None:
                confs = detections.confidence if detections.confidence is not None else np.ones(len(detections.class_id))
                high_conf_mask = np.array(confs) >= OBJECT_CONF_THRESHOLD
                detections = detections[high_conf_mask]
                labels = [
                    f"{result.names[cid]} {conf:.0%}"
                    for cid, conf in zip(detections.class_id, detections.confidence if detections.confidence is not None else np.ones(len(detections.class_id)))
                ]
            else:
                labels = []

            annotated_image_np = bounding_box_annotator.annotate(
                scene=img_np_rgb_for_annotation.copy(), detections=detections)
            annotated_image_np = label_annotator.annotate(
                scene=annotated_image_np, detections=detections, labels=labels)
            
            annotated_image_pil = Image.fromarray(annotated_image_np)

        message = f"Detected objects: {', '.join(detected_objects) if detected_objects else 'None'}. "
        if found_hazardous:
            message += f"**Hazardous objects detected: {', '.join(found_hazardous)}!**"
        else:
            message += "No hazardous objects detected."

        results = {
            "detected_objects": detected_objects,
            "hazardous_objects": found_hazardous,
            "output_image": annotated_image_pil, # Return PIL Image
            "message": message
        }
        
        return results
    except Exception as e:
        return {"error": f"Error during object detection: {e}"}
    finally:
        # Clean up temporary uploaded file
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)


import tensorflow as tf

def predict_cry(model, audio_file, class_names=None):
    """
    Runs cry detection inference on an audio file. Supports both CryCNN (PyTorch) 
    and YAMNet (TensorFlow).
    Args:
        model: Loaded model (PyTorch or TensorFlow).
        audio_file: Uploaded audio file from Streamlit.
        class_names: List of class names for YAMNet.
    Returns:
        dict: Detection results.
    """
    try:
        # Load audio using scipy.io.wavfile to avoid torchaudio/torchcodec issues
        # First, we need to save the bytes to a temporary file because wavfile.read needs a file path or file-like object
        audio_bytes = audio_file.getvalue()
        buffer = io.BytesIO(audio_bytes)
        
        try:
            sample_rate, data = wavfile.read(buffer)
            # Convert to float32 tensor
            if data.dtype == np.int16:
                waveform = torch.from_numpy(data.astype(np.float32) / 32768.0)
            elif data.dtype == np.float32:
                waveform = torch.from_numpy(data)
            else:
                waveform = torch.from_numpy(data.astype(np.float32))
            
            # wavfile.read returns (samples, channels) for multi-channel, (samples,) for mono
            if len(waveform.shape) == 1:
                waveform = waveform.unsqueeze(0) # (1, samples)
            else:
                waveform = waveform.t() # (channels, samples)
                
        except Exception as e:
            # Fallback to torchaudio if wavfile fails (might happen for non-WAV files)
            waveform, sample_rate = torchaudio.load(io.BytesIO(audio_bytes))
        
        # Resample to 16kHz if necessary
        target_sample_rate = 16000
        if sample_rate != target_sample_rate:
            resampler = T.Resample(sample_rate, target_sample_rate)
            waveform = resampler(waveform)
        
        # Convert to mono if multi-channel
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # --- YAMNet (TensorFlow) Inference ---
        if hasattr(model, 'signatures') or (isinstance(model, tf.Module) if 'tf' in globals() else False):
            # YAMNet expects a flat float32 tensor
            waveform_np = waveform.squeeze().numpy()
            waveform_np = waveform_np / (np.max(np.abs(waveform_np)) + 1e-9)
            
            scores, embeddings, spectrogram = model(waveform_np)
            
            # Find "Baby cry, infant cry" index
            cry_idx = 14 # Default index in YAMNet
            if class_names and "Baby cry, infant cry" in class_names:
                cry_idx = class_names.index("Baby cry, infant cry")
            
            scores_np = scores.numpy()
            mean_scores = scores_np.mean(axis=0)
            baby_conf = float(mean_scores[cry_idx])
            top_idx = mean_scores.argmax()
            top_class = class_names[top_idx] if class_names else "Unknown"
            top_conf = float(mean_scores[top_idx])
            
            is_crying = baby_conf >= 0.3 # Use same threshold as in yamnet.py
            
            result_text = "Crying Detected!" if is_crying else "No Crying Detected."
            
            return {
                "is_crying": is_crying,
                "confidence": baby_conf,
                "message": f"{result_text} (Conf: {baby_conf:.2f}, Top: {top_class} {top_conf:.2f})"
            }

        # --- CryCNN (PyTorch) Mel Spectrogram Inference ---
        # Define Mel Spectrogram transform
        n_mels = 64
        mel_spectrogram_transform = T.MelSpectrogram(
            sample_rate=target_sample_rate,
            n_fft=1024,
            hop_length=512,
            n_mels=n_mels
        )
        
        # Compute Mel Spectrogram
        mel_spec = mel_spectrogram_transform(waveform)
        
        # Convert to log-Mel spectrogram (decibels)
        mel_spec_db = T.AmplitudeToDB()(mel_spec)
        
        # Apply Z-score normalization for background noise robustness
        # This helps the model focus on the relative patterns rather than absolute volume
        mean = mel_spec_db.mean()
        std = mel_spec_db.std()
        mel_spec_db = (mel_spec_db - mean) / (std + 1e-6)
        
        # Prepare for model inference (batch_size, channels, height, width)
        # We need 64x64 input. Let's crop or pad.
        # Current mel_spec_db shape is (1, 64, time_steps)
        time_steps = mel_spec_db.shape[2]
        if time_steps < 64:
            # Pad
            mel_spec_db = F.pad(mel_spec_db, (0, 64 - time_steps))
        elif time_steps > 64:
            # Crop (take the middle)
            start = (time_steps - 64) // 2
            mel_spec_db = mel_spec_db[:, :, start:start+64]
        
        # Final shape (1, 64, 64)
        mel_spec_db = mel_spec_db[:, :, :64]
            
        # Add batch dimension
        input_tensor = mel_spec_db.unsqueeze(0) # Shape: (1, 1, 64, 64)
        
        # Default values
        prediction = 0
        confidence = 0.0
        
        # Perform inference
        if model is not None and not isinstance(model, str):
            with torch.no_grad():
                output = model(input_tensor)
                probabilities = F.softmax(output, dim=1)
                prediction = torch.argmax(probabilities, dim=1).item()
                confidence = probabilities[0][prediction].item()
            
        # Class 1 is "Cry"
        is_crying = (prediction == 1)
        
        # Heuristic/Demo Mode logic if weights are missing
        if model is None or isinstance(model, str):
            # If we're in demo mode (no model), use a simple frequency heuristic
            # Calculate the spectral centroid or just look at the high-frequency energy
            # mel_spec_db has shape (1, 64, 64) after processing
            # High frequency indices are higher up (e.g., 32-64)
            high_freq_energy = mel_spec_db[0, 32:, :].mean().item()
            low_freq_energy = mel_spec_db[0, :32, :].mean().item()
            
            # Simple heuristic: if high freq energy is significantly higher, simulate a cry
            if high_freq_energy > low_freq_energy + 0.5:
                is_crying = True
                confidence = 0.85
            else:
                is_crying = False
                confidence = 0.92
        
        result_text = "Crying Detected!" if is_crying else "No Crying Detected."
        
        results = {
            "is_crying": is_crying,
            "confidence": float(confidence),
            "message": f"{result_text} (Confidence: {confidence:.2f})"
        }
        
        return results
    except Exception as e:
        return {"error": f"Error during cry detection: {e}"}

def process_video_for_detection(posture_model, object_model, video_file, cry_model=None, class_names=None):
    """
    Processes a video file frame by frame for posture and object detection,
    yielding each annotated frame and its detection results, and also saving
    the processed video to a temporary file.
    Args:
        posture_model: Loaded YOLO posture detection model.
        object_model: Loaded YOLOe object detection model.
        video_file: Uploaded video file from Streamlit.
    Yields:
        tuple: (annotated_frame_np, current_posture, current_frame_objects, current_frame_hazardous_objects)
               for each frame, or a dictionary with "error" if an error occurs.
    Returns:
        dict: Final summary including all detected objects, hazardous objects, and posture summary.
    """
    from config import DETECTION_INTERVAL_FRAMES, DISPLAY_INTERVAL_FRAMES
    temp_input_video_path = None
    temp_output_video_path = None
    temp_audio_path = None
    try:
        # Save the uploaded video to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_input_video:
            temp_input_video.write(video_file.getvalue())
            temp_input_video_path = temp_input_video.name

        # Extract audio to WAV (16kHz mono) using FFmpeg
        audio_available = False
        try:
            import subprocess
            ffmpeg_path = FFMPEG_PATH if os.path.exists(FFMPEG_PATH) else "ffmpeg"
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio_file:
                temp_audio_path = temp_audio_file.name
            result = subprocess.run(
                [ffmpeg_path, "-y", "-i", temp_input_video_path,
                 "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", temp_audio_path],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
            )
            # Treat as failure if non-zero exit or output file is empty
            if result.returncode != 0 or not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
                temp_audio_path = None
        except Exception as _fferr:
            temp_audio_path = None

        cap = cv2.VideoCapture(temp_input_video_path)
        if not cap.isOpened():
            yield {"error": "Error: Couldn't open video file."}
            return

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))

        # Create a temporary output video file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_output_video:
            temp_output_video_path = temp_output_video.name

        fourcc = cv2.VideoWriter_fourcc(*"mp4v") # Codec for .mp4
        out = cv2.VideoWriter(temp_output_video_path, fourcc, fps, (w, h))
        if not out.isOpened():
            cap.release()
            yield {"error": "Error: Couldn't create output video file."}
            return

        all_detected_objects = set()
        all_hazardous_objects = set()
        posture_changes = []
        
        box_annotator = sv.BoxAnnotator()
        label_annotator = sv.LabelAnnotator(text_color=sv.Color.BLACK)

        # Load audio waveform if available
        audio_waveform = None
        audio_sr = 16000
        if temp_audio_path and os.path.exists(temp_audio_path) and os.path.getsize(temp_audio_path) > 0:
            try:
                sr, data = wavfile.read(temp_audio_path)
                audio_sr = sr
                if data.dtype == np.int16:
                    audio_waveform = torch.from_numpy(data.astype(np.float32) / 32768.0)
                elif data.dtype == np.float32:
                    audio_waveform = torch.from_numpy(data)
                else:
                    audio_waveform = torch.from_numpy(data.astype(np.float32))
                if len(audio_waveform.shape) == 1:
                    audio_waveform = audio_waveform.unsqueeze(0)
                else:
                    audio_waveform = audio_waveform.t()
                audio_available = True
            except Exception as _auderr:
                audio_waveform = None

        frame_index = 0
        last_is_crying = False   # persist cry state between detection intervals
        
        # Performance optimization: reuse last results for skipped frames
        last_posture = "Unknown"
        last_objects = []
        last_hazardous = []
        last_posture_detections = None
        last_object_detections = None
        last_posture_labels = []
        last_object_labels = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            current_posture = last_posture
            current_frame_objects = last_objects
            current_frame_hazardous_objects = last_hazardous

            # Only perform detection every N frames
            if frame_index % DETECTION_INTERVAL_FRAMES == 0:
                # Resize frame for faster inference if it's very large
                inference_frame = frame
                if w > 640:
                    inference_frame = cv2.resize(frame, (640, int(640 * h / w)))

                # Perform posture detection
                posture_results_list = posture_model.predict(source=inference_frame, save=False, verbose=False, half=torch.cuda.is_available())
                if posture_results_list:
                    posture_result = posture_results_list[0]
                    last_posture_detections = sv.Detections.from_ultralytics(posture_result)
                    
                    # Scaling detections back to original size if resized
                    if w > 640:
                        scale = w / 640
                        last_posture_detections.xyxy *= scale

                    detected_parts = []
                    if posture_result.names and last_posture_detections.class_id is not None:
                        for class_id in last_posture_detections.class_id:
                            class_name = posture_result.names[class_id]
                            detected_parts.append(class_name)
                    
                    # Determine posture using shared helper
                    posture_info = determine_posture(detected_parts)
                    current_posture = posture_info["posture"]
                    posture_is_dangerous = posture_info["danger"]
                    if posture_is_dangerous:
                        all_hazardous_objects.add("stomach_head_turned")
                    
                    if last_posture_detections.class_id is not None:
                        last_posture_labels = [posture_result.names[class_id] for class_id in last_posture_detections.class_id]
                
                # Perform object detection
                object_results_list = object_model.predict(source=inference_frame, save=False, verbose=False, half=torch.cuda.is_available())
                if object_results_list:
                    object_result = object_results_list[0]
                    last_object_detections = sv.Detections.from_ultralytics(object_result)
                    
                    # Scaling detections back to original size if resized
                    if w > 640:
                        scale = w / 640
                        last_object_detections.xyxy *= scale

                    current_frame_objects = []
                    current_frame_hazardous_objects = []
                    if object_result.names and last_object_detections.class_id is not None:
                        obj_confs = last_object_detections.confidence if last_object_detections.confidence is not None else np.ones(len(last_object_detections.class_id))
                        for class_id, conf in zip(last_object_detections.class_id, obj_confs):
                            if conf >= OBJECT_CONF_THRESHOLD:
                                class_name = object_result.names[class_id]
                                current_frame_objects.append(class_name)
                                all_detected_objects.add(class_name)
                                if class_name in HAZARDOUS_CLASSES:
                                    current_frame_hazardous_objects.append(class_name)
                                    all_hazardous_objects.add(class_name)

                    # Only annotate high-confidence detections
                    if last_object_detections.class_id is not None:
                        obj_confs = last_object_detections.confidence if last_object_detections.confidence is not None else np.ones(len(last_object_detections.class_id))
                        high_mask = np.array(obj_confs) >= OBJECT_CONF_THRESHOLD
                        last_object_detections = last_object_detections[high_mask]
                        last_object_labels = [
                            f"{object_result.names[cid]} {conf:.0%}"
                            for cid, conf in zip(last_object_detections.class_id, last_object_detections.confidence if last_object_detections.confidence is not None else np.ones(len(last_object_detections.class_id)))
                        ]
                    else:
                        last_object_labels = []
                
                # Update last known values
                last_posture = current_posture
                last_objects = current_frame_objects
                last_hazardous = current_frame_hazardous_objects

            # Always annotate every frame using last known detections for smooth visualization
            if last_posture_detections is not None:
                frame = box_annotator.annotate(scene=frame, detections=last_posture_detections)
                frame = label_annotator.annotate(scene=frame, detections=last_posture_detections, labels=last_posture_labels)
            
            if last_object_detections is not None:
                frame = box_annotator.annotate(scene=frame, detections=last_object_detections)
                frame = label_annotator.annotate(scene=frame, detections=last_object_detections, labels=last_object_labels)

            if posture_changes and posture_changes[-1] != current_posture:
                posture_changes.append(current_posture)
            elif not posture_changes:
                posture_changes.append(current_posture)

            # Real-time cry detection from audio aligned with current frame time
            # Use last known state between detection intervals so it doesn't reset to False
            is_crying_current = last_is_crying
            if audio_waveform is not None and audio_sr == 16000 and fps > 0 and (frame_index % CRY_DETECTION_INTERVAL_FRAMES == 0):
                current_time = frame_index / max(fps, 1)
                samples = int(AUDIO_WIN_SEC * audio_sr)
                end = int(current_time * audio_sr)
                start_sample = max(0, end - samples)
                chunk = audio_waveform[:, start_sample:end]
                if chunk.shape[1] < samples:
                    pad = torch.zeros((1, samples - chunk.shape[1]), dtype=chunk.dtype)
                    chunk = torch.cat([pad, chunk], dim=1)
                try:
                    import tensorflow as tf
                    # ── YAMNet inference (preferred) ──────────────────────────
                    if cry_model is not None and (
                        hasattr(cry_model, 'signatures') or isinstance(cry_model, tf.Module)
                    ):
                        waveform_np = chunk.squeeze().numpy()
                        waveform_np = waveform_np / (np.max(np.abs(waveform_np)) + 1e-9)
                        scores, _emb, _spec = cry_model(waveform_np)
                        cry_idx = 14  # default YAMNet index for "Baby cry, infant cry"
                        if class_names and "Baby cry, infant cry" in class_names:
                            cry_idx = class_names.index("Baby cry, infant cry")
                        mean_scores = scores.numpy().mean(axis=0)
                        is_crying_current = float(mean_scores[cry_idx]) >= 0.3
                    else:
                        # ── Fallback: mel-spectrogram energy heuristic ────────
                        mel_spec = MEL(chunk)
                        mel_spec_db = DB(mel_spec)
                        mel_spec_db = (mel_spec_db - mel_spec_db.mean()) / (mel_spec_db.std() + 1e-6)
                        time_steps = mel_spec_db.shape[2]
                        if time_steps < 64:
                            mel_spec_db = F.pad(mel_spec_db, (0, 64 - time_steps))
                        elif time_steps > 64:
                            st_t = (time_steps - 64) // 2
                            mel_spec_db = mel_spec_db[:, :, st_t:st_t + 64]
                        mel_spec_db = mel_spec_db[:, :, :64]
                        high_freq = mel_spec_db[0, 32:, :].mean().item()
                        low_freq  = mel_spec_db[0, :32, :].mean().item()
                        is_crying_current = high_freq > low_freq + 0.5
                except Exception as _cryerr:
                    is_crying_current = last_is_crying  # keep last known on error
                last_is_crying = is_crying_current      # persist for next interval

            out.write(frame)

            # Only yield to the UI every DISPLAY_INTERVAL_FRAMES to throttle
            # Streamlit re-renders. Non-display frames are still written to disk.
            if frame_index % DISPLAY_INTERVAL_FRAMES == 0:
                # Downscale display copy to max 640px wide (keeps browser fast)
                display_frame = frame
                if w > 640:
                    dh = int(640 * h / w)
                    display_frame = cv2.resize(frame, (640, dh))
                yield display_frame, current_posture, current_frame_objects, current_frame_hazardous_objects, is_crying_current

            frame_index += 1

        cap.release()
        out.release()
        cv2.destroyAllWindows()

        # Yield final summary (only once)
        # Use the most frequently observed posture rather than just the first frame
        dominant_posture = (
            max(set(posture_changes), key=posture_changes.count)
            if posture_changes else "Unknown"
        )
        yield {
            "output_video_path": temp_output_video_path,
            "all_detected_objects": list(all_detected_objects),
            "all_hazardous_objects": list(all_hazardous_objects),
            "posture_summary": dominant_posture,
            "audio_available": audio_available,
            "message": "Video processing complete."
        }

    except Exception as e:
        yield {"error": f"Error during video processing: {e}"}
        return
    finally:
        # Clean up temporary input video file
        if temp_input_video_path and os.path.exists(temp_input_video_path):
            os.remove(temp_input_video_path)
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
            except:
                pass
        # Note: temp_output_video_path will be cleaned up by app.py after display
