import torch
import streamlit as st
import os
from ultralytics import YOLO, YOLOE # Import YOLO for best.pt, YOLOE for object detection
from .audio_model import CryCNN, get_model # Import our custom audio model
import tensorflow as tf
import csv

# Define absolute paths for models
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DEFAULT_POSTURE_MODEL = os.path.join(MODELS_DIR, "best.pt")
DEFAULT_OBJECT_MODEL = os.path.join(MODELS_DIR, "yoloe-26s-seg.pt")
FALLBACK_OBJECT_MODEL = os.path.join(BASE_DIR, "..", "yolo11s-seg.pt")
DEFAULT_CRY_MODEL = os.path.join(MODELS_DIR, "cry_detection_audio.pt")

HAZARDOUS_CLASSES = [
    "knife", "scissors", "glass", "plastic bag", "small toy",
    "cord", "medication", "battery", "coin", "choking hazard", "insects",
    "snake", "python snake", "scorpion", "bug", "sharp object",
    "loose sheet", "crib bumper", "stuffed animal", "plush toy",
    "sleep positioner", "wedge",
    "pacifier", "pacifier clip", "teething toy",
    "small block", "bead", "marble", "button",
    "hair tie", "hair clip", "bobby pin",
    "pen cap", "marker cap",
    "screw", "nail", "bolt",
    "foam piece", "sponge piece", "stuffing",
    "rope", "string", "ribbon", "lanyard",
    "window blind cord", "curtain cord", "pull cord",
    "cosmetics", "cream jar", "lip balm", "lipstick", "nail polish",
    "hand sanitizer", "essential oil bottle", "insect repellent", "cleaning product", "wipes",
    "e-cigarette", "lighter", "matches",
    "paint", "glue",
    "charger", "usb cable", "power cord", "power strip", "extension cord",
    "night light", "lamp", "baby monitor",
    "space heater", "heater",
    "hot drink", "mug", "bottle warmer",
    "hard toy",
    "pet toy", "pet food", "pet fur",
    "rodent droppings", "ant", "cockroach", "spider",
    "mold", "moldy object",
]

@st.cache_resource
def load_posture_detection_model(model_path=DEFAULT_POSTURE_MODEL):
    """
    Loads the posture detection model (best.pt).
    Args:
        model_path (str): Path to the posture detection model file (best.pt).
    Returns:
        YOLO: Loaded YOLO model.
    """
    try:
        # Load the YOLO model from the local path
        model = YOLO(model_path)
        # Move model to CUDA if available, otherwise to CPU
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.to(device)
        st.info(f"Loaded posture detection model to {device}")
        # No need to set classes explicitly if the model is already trained on them
        # The model.names attribute will contain the trained classes.
        return model
    except Exception as e:
        st.error(f"Error loading posture detection model from {model_path}: {e}")
        return None

@st.cache_resource
def load_object_detection_model(model_path=DEFAULT_OBJECT_MODEL):
    """
    Loads the YOLOe object detection model from the local models directory.
    Args:
        model_path (str): Path to the YOLOe model file (e.g., models/yoloe-11s-seg.pt).
    Returns:
        YOLOE: Loaded YOLOe model.
    """
    try:
        # Load the YOLOe model from the local path
        # Using YOLOE class as officially requested
        model = YOLOE(model_path)
        # Move model to CUDA if available, otherwise to CPU
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.to(device)
        st.info(f"Loaded object detection model to {device}")
        # Define hazardous objects for zero-shot prompting
        try:
            model.set_classes(HAZARDOUS_CLASSES, model.get_text_pe(HAZARDOUS_CLASSES))
        except (AttributeError, AssertionError):
            # Fallback if set_classes/get_text_pe are not available or fail assertion (e.g. non-World model)
            st.warning("Custom classes setup skipped (incompatible model architecture). Using default model classes.")
        
        return model
    except Exception as e:
        st.warning(f"model found from model library: {model_path}: {e}")
        st.info(f"loaded YOLOE model from {FALLBACK_OBJECT_MODEL}...")
        try:
            model = YOLO(FALLBACK_OBJECT_MODEL)
            # Move fallback model to CUDA if available, otherwise to CPU
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            model.to(device)
            st.info(f"Loaded fallback object detection model to {device}")
            return model
        except Exception as fallback_e:
            st.error(f"Error loading fallback model: {fallback_e}")
            return None

@st.cache_resource
def load_yamnet_model(model_path=MODELS_DIR):
    """
    Loads the YAMNet model from the local models directory.
    Args:
        model_path (str): Path to the SavedModel directory.
    Returns:
        tuple: (model, class_names)
    """
    try:
        if not os.path.exists(model_path):
            st.error(f"Error: Model path '{model_path}' not found.")
            return None, []
            
        model = tf.saved_model.load(model_path)
        
        # Load class names
        class_names = []
        try:
            class_map_path = model.class_map_path().numpy()
            with tf.io.gfile.GFile(class_map_path) as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    class_names.append(row['display_name'])
        except Exception:
            # Fallback to local csv if it exists
            fallback_path = os.path.join(model_path, "yamnet_class_map.csv")
            if os.path.exists(fallback_path):
                with open(fallback_path, 'r') as csvfile:
                    reader = csv.DictReader(csvfile)
                    for row in reader:
                        class_names.append(row['display_name'])
            else:
                # Default minimal list
                class_names = ["Baby cry, infant cry"] * 521 
        
        st.info("YAMNet model loaded successfully.")
        return model, class_names
    except Exception as e:
        st.error(f"Error loading YAMNet model: {e}")
        return None, []

@st.cache_resource
def load_cry_detection_model(model_path=DEFAULT_CRY_MODEL):
    """
    Loads the custom audio-based cry detection model.
    Args:
        model_path (str): Path to the model weights (.pt).
    Returns:
        torch.nn.Module: Loaded CryCNN model.
    """
    try:
        model = get_model()
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        if os.path.exists(model_path):
            model.load_state_dict(torch.load(model_path, map_location=device))
            model.to(device)
            st.info(f"Loaded cry detection weights from {model_path} to {device}")
        else:
            st.warning(f"Cry detection weights not found at {model_path}. Using uninitialized model (demo mode).")
        return model
    except Exception as e:
        st.error(f"Error loading cry detection model: {e}")
        return None
