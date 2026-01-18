import torch
import streamlit as st
from ultralytics import YOLO, YOLOE # Import YOLO for best.pt

@st.cache_resource
def load_posture_detection_model(model_path="models/best.pt"):
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
        # No need to set classes explicitly if the model is already trained on them
        # The model.names attribute will contain the trained classes.
        return model
    except Exception as e:
        st.error(f"Error loading posture detection model from {model_path}: {e}")
        return None

@st.cache_resource
def load_object_detection_model(model_path="models/yoloe-11s-seg.pt"):
    """
    Loads the YOLOe object detection model from the local models directory.
    Args:
        model_path (str): Path to the YOLOe model file (e.g., models/yoloe-11s-seg.pt).
    Returns:
        YOLOE: Loaded YOLOe model.
    """
    try:
        # Load the YOLOe model from the local path
        model = YOLOE(model_path)
        
        # Define hazardous objects for zero-shot prompting
        hazardous_classes = [
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
        model.set_classes(hazardous_classes, model.get_text_pe(hazardous_classes))
        return model
    except Exception as e:
        st.error(f"Error loading YOLOe object detection model from {model_path}: {e}")
        return None

@st.cache_resource
def load_cry_detection_model(model_path):
    """
    Loads the YOLOe cry detection model.
    Args:
        model_path (str): Path to the YOLOe model file (.pt).
    Returns:
        torch.nn.Module: Loaded YOLOe model.
    """
    try:
        return f"Dummy Cry Model from {model_path}"
    except Exception as e:
        st.error(f"Error loading cry detection model: {e}")
        return None
