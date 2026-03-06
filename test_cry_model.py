import torch
import torchaudio
import os
import sys
import io
import numpy as np
from scipy.io import wavfile

# Add the project directory and simulator directory to path so we can import our modules
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
simulator_dir = os.path.join(project_root, "simulator")
sys.path.append(project_root)
sys.path.append(simulator_dir)

from simulator.utils.model_loader import load_cry_detection_model, load_yamnet_model
from simulator.utils.inference import predict_cry

def create_test_audio(filename, freq=440, duration=1.0, sr=16000):
    """Creates a simple sine wave audio file using scipy to avoid torchaudio.save issues."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    waveform = np.sin(2 * np.pi * freq * t)
    # Convert to 16-bit PCM
    waveform_int16 = (waveform * 32767).astype(np.int16)
    wavfile.write(filename, sr, waveform_int16)
    print(f"Created test audio: {filename}")

class MockAudioFile:
    """Mocks a Streamlit UploadedFile object."""
    def __init__(self, filepath):
        with open(filepath, "rb") as f:
            self.data = f.read()
        self.name = os.path.basename(filepath)
    
    def getvalue(self):
        return self.data
    
    def read(self):
        return self.data

def test_cry_detection():
    print("--- Starting Cry Detection Model Test ---")
    
    test_dir = "test_assets"
    os.makedirs(test_dir, exist_ok=True)
    
    # Check for real baby crying audio
    real_cry_file = os.path.join(test_dir, "baby-crying-01.wav")
    has_real_cry = os.path.exists(real_cry_file)
    
    # Use a different name for simulation to avoid any confusion or overwriting
    sim_cry_file = os.path.join(test_dir, "test_sim_beep.wav")
    if not os.path.exists(sim_cry_file):
        print(f"Creating simulated 'beep' for noise testing at {sim_cry_file}...")
        create_test_audio(sim_cry_file, freq=1200, duration=2.0)
    
    noise_file = os.path.join(test_dir, "test_noise.wav")
    if not os.path.exists(noise_file):
        create_test_audio(noise_file, freq=100, duration=2.0) # Low frequency hum

    # 1. Load Model (Old)
    print("\n[Testing Old CryCNN]")
    model = load_cry_detection_model()
    if model is not None:
        # 3. Run Inference on Noise
        print("\nTesting with 'Noise' (100Hz)...")
        noise_mock = MockAudioFile(noise_file)
        results_noise = predict_cry(model, noise_mock)
        print(f"Full results: {results_noise}")

        # 4. Run Inference on Real Cry if it exists, else use simulation
        test_file = real_cry_file if has_real_cry else sim_cry_file
        label = "Real Cry (baby-crying-01.wav)" if has_real_cry else "Simulated Beep (1200Hz)"
        
        print(f"\nTesting with '{label}'...")
        cry_mock = MockAudioFile(test_file)
        results_cry = predict_cry(model, cry_mock)
        print(f"Full results: {results_cry}")
    
    # 5. Load Model (YAMNet)
    print("\n" + "="*20)
    print("[Testing New YAMNet]")
    yamnet_model, class_names = load_yamnet_model()
    if yamnet_model is not None:
        # Test YAMNet with the same audio
        test_file = real_cry_file if has_real_cry else sim_cry_file
        label = "Real Cry (baby-crying-01.wav)" if has_real_cry else "Simulated Beep (1200Hz)"
        
        print(f"\nTesting YAMNet with '{label}'...")
        cry_mock = MockAudioFile(test_file)
        results_yamnet = predict_cry(yamnet_model, cry_mock, class_names=class_names)
        
        print(f"Full results: {results_yamnet}")
        print(f"Is Crying: {results_yamnet.get('is_crying')}")
        print(f"Top Class Detected: {results_yamnet.get('message')}")
        
        # If it detects 'Beep' when it was supposed to be a real cry, warn the user
        if has_real_cry and "Beep" in str(results_yamnet.get('message')):
            print("\n⚠️  WARNING: YAMNet detected 'Beep, bleep' instead of a cry.")
            print("   This likely means your 'baby-crying-01.wav' was overwritten by a previous run of this script.")
            print("   Please restore your original file to the 'test_assets' folder.")
    else:
        print("FAILED: YAMNet could not be loaded.")

    print("\n--- Test Complete ---")

if __name__ == "__main__":
    test_cry_detection()
