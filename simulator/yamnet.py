# ──────────────────────────────────────────────────────────────────────────────
# YAMNet Baby Cry Detection Pipeline (Local Model)
# ──────────────────────────────────────────────────────────────────────────────
# pip install tensorflow librosa soundfile matplotlib scipy
# ──────────────────────────────────────────────────────────────────────────────

import os
import csv
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
import librosa
import soundfile as sf
from scipy.io import wavfile
import scipy.signal


# ── Config ────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models")    # path to your extracted model folder
AUDIO_FILE = os.path.join(BASE_DIR, "..", "test_assets", "baby-crying-01.wav")    # path to your audio file
THRESHOLD  = 0.3               # confidence threshold (0.0 – 1.0)


# ── 1. Load Model ─────────────────────────────────────────────────────────────

def load_model(model_path=MODEL_PATH):
    print(f"Loading model from '{model_path}' ...")
    if not os.path.exists(model_path):
        print(f"❌ Error: Model path '{model_path}' not found.")
        return None
    try:
        model = tf.saved_model.load(model_path)
        print("✅ Model loaded.")
        return model
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return None


# ── 2. Load Class Names ───────────────────────────────────────────────────────

def load_class_names(model):
    if model is None:
        return []
    class_names = []
    try:
        class_map_path = model.class_map_path().numpy()
        with tf.io.gfile.GFile(class_map_path) as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                class_names.append(row['display_name'])
        print(f"✅ {len(class_names)} class names loaded.")
    except Exception as e:
        print(f"❌ Warning: Could not load class names from model assets: {e}")
        # Try to find it in the models directory as a fallback
        fallback_path = os.path.join(MODEL_PATH, "yamnet_class_map.csv")
        if os.path.exists(fallback_path):
            print(f"   Found fallback class map at {fallback_path}")
            with open(fallback_path, 'r') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    class_names.append(row['display_name'])
            print(f"✅ {len(class_names)} class names loaded from fallback.")
        else:
            print("   Using a minimal default class list (may be inaccurate).")
            class_names = ["Baby cry, infant cry"] * 521 # Placeholder
    return class_names


# ── 3. Convert Any Audio to 16kHz WAV ────────────────────────────────────────

def convert_to_16k_wav(input_path, output_path=None):
    if output_path is None:
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}_16k.wav"

    waveform, _ = librosa.load(input_path, sr=16000, mono=True)
    waveform = waveform / np.max(np.abs(waveform) + 1e-9)
    sf.write(output_path, waveform, 16000, subtype='PCM_16')

    print(f"✅ Converted : {input_path}")
    print(f"   Saved to  : {output_path}")
    print(f"   Duration  : {len(waveform)/16000:.2f}s")

    return output_path


# ── 4. Load WAV ───────────────────────────────────────────────────────────────

def load_audio(wav_path):
    sample_rate, wav_data = wavfile.read(wav_path, 'rb')

    if sample_rate != 16000:
        desired_length = int(round(float(len(wav_data)) / sample_rate * 16000))
        wav_data = scipy.signal.resample(wav_data, desired_length)
        sample_rate = 16000

    print(f"   Sample rate : {sample_rate} Hz")
    print(f"   Duration    : {len(wav_data)/sample_rate:.2f}s")

    waveform = wav_data / tf.int16.max
    return waveform


# ── 5. Run YAMNet ─────────────────────────────────────────────────────────────

def run_yamnet(model, waveform):
    scores, embeddings, spectrogram = model(waveform)
    print(f"   Frames     : {scores.shape[0]}")
    print(f"   Embeddings : {embeddings.shape}")
    return scores, embeddings, spectrogram


# ── 6. Detect Baby Cry ────────────────────────────────────────────────────────

def detect_baby_cry(scores, class_names, threshold=THRESHOLD):
    baby_cry_idx = class_names.index("Baby cry, infant cry") \
        if "Baby cry, infant cry" in class_names else 14

    scores_np   = scores.numpy()
    mean_scores = scores_np.mean(axis=0)
    baby_conf   = float(mean_scores[baby_cry_idx])
    top_idx     = mean_scores.argmax()

    return {
        "is_baby_cry"         : baby_conf >= threshold,
        "baby_cry_confidence" : baby_conf,
        "top_class"           : class_names[top_idx],
        "top_class_confidence": float(mean_scores[top_idx]),
        "verdict"             : "🍼 Baby Cry Detected!" if baby_conf >= threshold else "🔇 No Baby Cry"
    }


# ── 7. Visualize ──────────────────────────────────────────────────────────────

def visualize(waveform, spectrogram, scores, class_names, top_n=10):
    scores_np     = scores.numpy()
    mean_scores   = np.mean(scores_np, axis=0)
    top_indices   = np.argsort(mean_scores)[::-1][:top_n]
    patch_padding = (0.025 / 2) / 0.01

    plt.figure(figsize=(12, 8))

    plt.subplot(3, 1, 1)
    plt.plot(np.array(waveform))
    plt.title("Waveform")
    plt.xlim([0, len(waveform)])

    plt.subplot(3, 1, 2)
    plt.imshow(spectrogram.numpy().T, aspect='auto', interpolation='nearest', origin='lower')
    plt.title("Log-Mel Spectrogram")
    plt.colorbar()

    plt.subplot(3, 1, 3)
    plt.imshow(scores_np[:, top_indices].T, aspect='auto', interpolation='nearest', cmap='gray_r')
    plt.title(f"Top {top_n} Class Scores Over Time")
    plt.xlim([-patch_padding - 0.5, scores.shape[0] + patch_padding - 0.5])
    plt.yticks(range(top_n), [class_names[top_indices[x]] for x in range(top_n)])
    plt.ylim(-0.5 + np.array([top_n, 0]))

    plt.tight_layout()
    plt.savefig("yamnet_output.png", dpi=150, bbox_inches='tight')
    plt.show()
    print("✅ Plot saved → yamnet_output.png")


# ── 8. Full Pipeline ──────────────────────────────────────────────────────────

def run_pipeline(audio_path=AUDIO_FILE, threshold=THRESHOLD, visualize_output=True):
    print("\n" + "="*55)
    print("  YAMNet Baby Cry Detection Pipeline")
    print("="*55)

    # Load model & class names
    model       = load_model(MODEL_PATH)
    if model is None:
        return {"error": "Model could not be loaded."}
    
    class_names = load_class_names(model)
    if not class_names:
        return {"error": "Class names could not be loaded."}

    # Convert audio
    print("\n[1/4] Converting audio...")
    try:
        if not os.path.exists(audio_path):
             print(f"❌ Error: Audio file '{audio_path}' not found.")
             return {"error": "Audio file not found."}
        wav_path = convert_to_16k_wav(audio_path)
    except Exception as e:
        print(f"❌ Error converting audio: {e}")
        return {"error": str(e)}

    # Load audio
    print("\n[2/4] Loading audio...")
    try:
        waveform = load_audio(wav_path)
    except Exception as e:
        print(f"❌ Error loading audio: {e}")
        return {"error": str(e)}

    # Run inference
    print("\n[3/4] Running inference...")
    try:
        scores, embeddings, spectrogram = run_yamnet(model, waveform)
    except Exception as e:
        print(f"❌ Error running inference: {e}")
        return {"error": str(e)}

    # Detect
    print("\n[4/4] Detecting baby cry...")
    try:
        result = detect_baby_cry(scores, class_names, threshold)
    except Exception as e:
        print(f"❌ Error detecting cry: {e}")
        return {"error": str(e)}

    print("\n" + "─"*55)
    print(f"  {result['verdict']}")
    print(f"  Baby Cry Confidence : {result['baby_cry_confidence']:.4f}")
    print(f"  Top Predicted Class : {result['top_class']} ({result['top_class_confidence']:.4f})")
    print("─"*55)

    if visualize_output:
        try:
            visualize(waveform, spectrogram, scores, class_names)
        except Exception as e:
            print(f"❌ Warning: Could not visualize: {e}")

    return result


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_pipeline(
        audio_path=AUDIO_FILE,
        threshold=THRESHOLD,
        visualize_output=True
    )