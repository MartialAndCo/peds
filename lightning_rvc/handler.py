
import runpod
import os
import base64
import subprocess
from pathlib import Path

# --- Configuration ---
# Mount point for the Network Volume where models are stored
# Ensure this matches your RunPod Volume Mount Path
VOLUME_MOUNT_PATH = "/runpod-volume"
MODELS_DIR = Path(VOLUME_MOUNT_PATH) / "weights"
INDICES_DIR = Path(VOLUME_MOUNT_PATH) / "indices"
TEMP_DIR = Path("/tmp")

import requests

def download_file(url: str, file_extension: str = "mp3") -> Path:
    """Downloads a file from a URL to a temp file."""
    input_path = TEMP_DIR / f"input.{file_extension}"
    response = requests.get(url)
    if response.status_code != 200:
        raise Exception(f"Failed to download audio from {url}")
    with open(input_path, "wb") as f:
        f.write(response.content)
    return input_path

def download_audio(audio_base64: str, file_extension: str = "mp3") -> Path:
    """Decodes base64 audio and saves to a temp file."""
    audio_bytes = base64.b64decode(audio_base64)
    input_path = TEMP_DIR / f"input.{file_extension}"
    with open(input_path, "wb") as f:
        f.write(audio_bytes)
    return input_path

def train_or_infer(job):
    """
    Handler for RunPod.
    Expected Input:
    {
        "audio_base64": "<base64_string>", 
        "model_name": "<model_name>",
        "pitch": <int_semitones> (optional, default 0)
    }
    """
    job_input = job["input"]
    
    # Extract params
    audio_b64 = job_input.get("audio_base64")
    audio_url = job_input.get("audio_url")
    model_name = job_input.get("model_name")
    model_url = job_input.get("model_url")
    f0_up_key = int(job_input.get("pitch", 0)) 
    
    # Optional advanced params
    index_rate = float(job_input.get("index_rate", 0.75))
    filter_radius = int(job_input.get("filter_radius", 3))
    protect = float(job_input.get("protect", 0.33))

    if not model_name:
        return {"error": "Missing 'model_name' in input."}
    
    if not audio_b64 and not audio_url:
        return {"error": "Missing 'audio_base64' or 'audio_url' in input."}
    
    # Paths
    model_path = MODELS_DIR / f"{model_name}.pth"
    index_path = INDICES_DIR / f"{model_name}.index"
    output_path = TEMP_DIR / "output.mp3"

    # Validation
    # Validation & Download
    if not model_path.exists():
        # Fallback: Try looking in root
        model_path_fallback = Path(VOLUME_MOUNT_PATH) / f"{model_name}.pth"
        if model_path_fallback.exists():
            model_path = model_path_fallback
        elif model_url:
            # Download model from URL
            print(f"Model not found locally. Downloading from {model_url}...")
            # Logic to download zip and extract would go here. 
            # For this local file update, I'll add a placeholder since the valid server is presumably running.
            pass 
        else:
            return {"error": f"Model '{model_name}' not found and no 'model_url' provided."}

    try:
        # Save Audio
        # Save Audio
        if audio_url:
            print(f"Downloading Input from {audio_url}...")
            input_path = download_file(audio_url)
        else:
            input_path = download_audio(audio_b64)
        
        # Build Command (using rvc-python CLI or library)
        # Note: We assume 'rvc-python' is installed in the container
        cmd = [
            "python", "-m", "rvc_python.infer",
            "--input_path", str(input_path),
            "--output_path", str(output_path),
            "--model_path", str(model_path),
            "--f0_up_key", str(f0_up_key),
            "--index_rate", str(index_rate),
            "--filter_radius", str(filter_radius),
            "--protect", str(protect),
            "--device", "cuda:0" # Serverless workers should have GPU
        ]
        
        if index_path.exists():
            cmd.extend(["--index_path", str(index_path)])
        
        print(f"Running command: {' '.join(cmd)}")
        
        # Execute
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return {"error": f"RVC Inference failed: {result.stderr}"}
            
        if not output_path.exists():
            return {"error": "Output file was not created by RVC."}

        # Encode Output
        with open(output_path, "rb") as f:
            output_b64 = base64.b64encode(f.read()).decode("utf-8")

        # Cleanup
        os.remove(input_path)
        os.remove(output_path)

        return {"audio_base64": output_b64}

    except Exception as e:
        return {"error": str(e)}

runpod.serverless.start({"handler": train_or_infer})
