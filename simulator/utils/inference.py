import torch
import numpy as np
from PIL import Image, ImageDraw
import io
import os
import cv2
import supervision as sv
import tempfile
import shutil
from ultralytics import YOLO, YOLOE # Import YOLO for posture detection, YOLOE for object detection

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
        annotated_image_pil = Image.fromarray(img_np_rgb) # Default to original if no detections or issues

        if results_list:
            result = results_list[0]
            
            # Convert Ultralytics results to supervision Detections
            detections = sv.Detections.from_ultralytics(result)

            # Get detected class names
            if result.names and detections.class_id is not None:
                for class_id in detections.class_id:
                    class_name = result.names[class_id]
                    detected_parts.append(class_name)
            
            # Determine posture based on detected parts
            if "Face" in detected_parts or "nose" in detected_parts:
                posture = "Baby is facing up"
            elif "back" in detected_parts or ("nose" not in detected_parts and "Face" not in detected_parts and "Lear" not in detected_parts and "Rear" not in detected_parts):
                posture = "Baby is sleeping on stomach"
            elif "Lear" in detected_parts or "Rear" in detected_parts:
                posture = "Baby is side sleeping (ear detected)"

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
            "output_image": annotated_image_pil, # Return PIL Image
            "message": f"Detected posture in image: {posture}"
        }
        return results
    except Exception as e:
        return {"error": f"Error during posture detection: {e}"}
    finally:
        # Clean up temporary uploaded file
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)
        try:
            os.rmdir(temp_upload_dir)
        except OSError:
            pass # Directory might not be empty if multiple files were uploaded or other issues

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

            # Get detected class names from result.names (which is model.names)
            if result.names and detections.class_id is not None:
                for class_id in detections.class_id:
                    class_name = result.names[class_id]
                    detected_objects.append(class_name)
            
            # Filter for hazardous objects (these classes are set in model_loader.py)
            if detected_objects:
                found_hazardous = list(set(detected_objects)) # Remove duplicates

            # Annotate image using supervision
            bounding_box_annotator = sv.BoxAnnotator()
            label_annotator = sv.LabelAnnotator(text_color=sv.Color.BLACK)

            labels = [
                result.names[class_id]
                for class_id
                in detections.class_id
            ] if detections.class_id is not None else []

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
        try:
            os.rmdir(temp_upload_dir)
        except OSError:
            pass # Directory might not be empty if multiple files were uploaded or other issues

def predict_cry(model, audio_file):
    """
    Runs cry detection inference on an audio file.
    Args:
        model: Loaded YOLOe cry detection model.
        audio_file: Uploaded audio file from Streamlit.
    Returns:
        Detection results.
    """
    try:
        # For audio, you'd typically load the audio, preprocess it (e.g., Mel spectrogram)
        # and then pass it to the model.
        # This is a placeholder for actual YOLOe audio inference logic.
        audio_bytes = audio_file.read()
        results = f"Detected cry in audio (dummy result for {audio_file.name}, length: {len(audio_bytes)} bytes)"
        return results
    except Exception as e:
        return f"Error during cry detection: {e}"

def process_video_for_detection(posture_model, object_model, video_file):
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
    temp_input_video_path = None
    temp_output_video_path = None
    try:
        # Save the uploaded video to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_input_video:
            temp_input_video.write(video_file.getvalue())
            temp_input_video_path = temp_input_video.name

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

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            current_posture = "Unknown"
            current_frame_objects = []
            current_frame_hazardous_objects = []

            # Perform posture detection
            posture_results_list = posture_model.predict(source=frame, save=False, verbose=False)
            if posture_results_list:
                posture_result = posture_results_list[0]
                posture_detections = sv.Detections.from_ultralytics(posture_result)
                detected_parts = []
                if posture_result.names and posture_detections.class_id is not None:
                    for class_id in posture_detections.class_id:
                        class_name = posture_result.names[class_id]
                        detected_parts.append(class_name)
                
                if "Face" in detected_parts or "nose" in detected_parts:
                    current_posture = "Baby is facing up"
                elif "back" in detected_parts or ("nose" not in detected_parts and "Face" not in detected_parts and "Lear" not in detected_parts and "Rear" not in detected_parts):
                    current_posture = "Baby is sleeping on stomach"
                elif "Lear" in detected_parts or "Rear" in detected_parts:
                    current_posture = "Baby is side sleeping (ear detected)"
                
                if posture_detections.class_id is not None:
                    posture_labels = [posture_result.names[class_id] for class_id in posture_detections.class_id]
                    frame = box_annotator.annotate(scene=frame, detections=posture_detections)
                    frame = label_annotator.annotate(scene=frame, detections=posture_detections, labels=posture_labels)
            
            if posture_changes and posture_changes[-1] != current_posture:
                posture_changes.append(current_posture)
            elif not posture_changes:
                posture_changes.append(current_posture)

            # Perform object detection
            object_results_list = object_model.predict(source=frame, save=False, verbose=False)
            if object_results_list:
                object_result = object_results_list[0]
                object_detections = sv.Detections.from_ultralytics(object_result)
                
                if object_result.names and object_detections.class_id is not None:
                    for class_id in object_detections.class_id:
                        class_name = object_result.names[class_id]
                        current_frame_objects.append(class_name)
                        all_detected_objects.add(class_name)
                        # Check if object is hazardous (assuming model.names contains hazardous classes)
                        if class_name in object_model.names and class_name in object_model.get_text_pe(object_model.names): # Simplified check
                             all_hazardous_objects.add(class_name)

                if object_detections.class_id is not None:
                    object_labels = [object_result.names[class_id] for class_id in object_detections.class_id]
                    frame = box_annotator.annotate(scene=frame, detections=object_detections)
                    frame = label_annotator.annotate(scene=frame, detections=object_detections, labels=object_labels)
            
            out.write(frame) # Write to output video
            yield frame, current_posture, current_frame_objects, current_frame_hazardous_objects # Yield for live display

        cap.release()
        out.release() # Release output video writer
        cv2.destroyAllWindows()

        # Return final summary as the last yielded item
        yield {
            "output_video_path": temp_output_video_path,
            "all_detected_objects": list(all_detected_objects),
            "all_hazardous_objects": list(all_hazardous_objects),
            "posture_summary": posture_changes[0] if posture_changes else "Unknown", # Simplistic summary
            "message": "Video processing complete."
        }

    except Exception as e:
        yield {"error": f"Error during video processing: {e}"}
        return
    finally:
        # Clean up temporary input video file
        if temp_input_video_path and os.path.exists(temp_input_video_path):
            os.remove(temp_input_video_path)
        # Note: temp_output_video_path will be cleaned up by app.py after display
