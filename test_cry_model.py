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

from simulator.utils.model_loader import load_cry_detection_model
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
    
    # 1. Load Model
    print("Loading model...")
    model = load_cry_detection_model()
    if model is None:
        print("FAILED: Model could not be loaded.")
        return

    # 2. Create test files if they don't exist
    test_dir = "test_assets"
    os.makedirs(test_dir, exist_ok=True)
    
    noise_file = os.path.join(test_dir, "test_noise.wav")
    create_test_audio(noise_file, freq=100, duration=2.0) # Low frequency hum
    
    cry_sim_file = os.path.join(test_dir, "test_cry_sim.wav")
    create_test_audio(cry_sim_file, freq=1200, duration=2.0) # High frequency (closer to cry)
    
    # 3. Run Inference on Noise
    print("\nTesting with 'Noise' (100Hz)...")
    noise_mock = MockAudioFile(noise_file)
    results_noise = predict_cry(model, noise_mock)
    print(f"Full results: {results_noise}")
    print(f"Result: {results_noise.get('message', 'No message')}")
    print(f"Is Crying: {results_noise.get('is_crying')}")
    print(f"Confidence: {results_noise.get('confidence', 0):.4f}")

    # 4. Run Inference on Simulated Cry
    print("\nTesting with 'Simulated Cry' (1200Hz)...")
    cry_mock = MockAudioFile(cry_sim_file)
    results_cry = predict_cry(model, cry_mock)
    print(f"Full results: {results_cry}")
    print(f"Result: {results_cry.get('message', 'No message')}")
    print(f"Is Crying: {results_cry.get('is_crying')}")
    print(f"Confidence: {results_cry.get('confidence', 0):.4f}")

    print("\n--- Test Complete ---")
    print("Note: Since the model weights may be uninitialized, the 'Is Crying' boolean may be random, but the pipeline (Spectrogram -> Normalization -> CNN) is verified if this script runs without error.")

if __name__ == "__main__":
    test_cry_detection()
