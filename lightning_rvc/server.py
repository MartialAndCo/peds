
import os
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
import shutil
import subprocess
from pathlib import Path

app = FastAPI()


# Paths
BASE_DIR = Path(__file__).parent.resolve()
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
LOCAL_WEIGHTS_DIR = BASE_DIR / "weights"
LOCAL_INDICES_DIR = BASE_DIR / "indices"

# Attempt to locate RVC WebUI directories for shared models
WEBUI_DIR = BASE_DIR.parent / "Retrieval-based-Voice-Conversion-WebUI"
WEBUI_WEIGHTS_DIR = WEBUI_DIR / "weights"
WEBUI_LOGS_DIR = WEBUI_DIR / "logs"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
LOCAL_WEIGHTS_DIR.mkdir(exist_ok=True)
LOCAL_INDICES_DIR.mkdir(exist_ok=True)

def find_model_path(model_name: str):
    # 1. Check local weights
    p = LOCAL_WEIGHTS_DIR / f"{model_name}.pth"
    if p.exists(): return p
    # 2. Check WebUI weights
    p = WEBUI_WEIGHTS_DIR / f"{model_name}.pth"
    if p.exists(): return p
    # 3. Check assets/weights (another common RVC path)
    p = WEBUI_DIR / "assets" / "weights" / f"{model_name}.pth"
    if p.exists(): return p
    return None

def find_index_path(model_name: str):
    # Check local
    p = LOCAL_INDICES_DIR / f"{model_name}.index"
    if p.exists(): return p
    # Check WebUI logs (often where indexes are kept after training, inside a folder named after the experiment)
    # This is trickier as they are in subfolders. For now, simple check.
    return None


# Placeholder for RVC inference function
# In a real setup, you would import the RVC library
# from rvc_python.infer import infer_file

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/convert")
async def convert_voice(
    file: UploadFile = File(...),
    model_name: str = "my_model",
    f0_up_key: int = 0, # Pitch shift
):
    try:
        # 1. Save input file
        input_path = UPLOAD_DIR / file.filename
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Define output path
        output_filename = f"converted_{file.filename}"
        output_path = OUTPUT_DIR / output_filename

        # 3. Validation: Find model
        model_path = find_model_path(model_name)
        if not model_path:
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found in uploads or RVC WebUI folders.")

        # Index path (Optional, logic can be expanded)
        index_path = INDICES_DIR / f"{model_name}.index"
        
        # NOTE: For now, assuming RVC is installed in the environment
        # We will use a subprocess call to a hypothetical CLI or library wrapper
        # Adjust this command based on the actual installed RVC library usage
        
        print(f"Processing {input_path} with model {model_name}...")

        # --- ACTUAL INFERENCE ---
        # Assuming rvc-python is installed and available in the environment
        cmd = [
            "python", "-m", "rvc_python.infer",
            "--input_path", str(input_path),
            "--output_path", str(output_path),
            "--model_path", str(model_path),
            # "--index_path", str(index_path), # Optional: Add if index exists
            "--f0_up_key", str(f0_up_key),
            "--device", "cuda:0" # Use GPU if available
        ]
        
        # Check if index exists and append
        if index_path.exists():
             cmd.extend(["--index_path", str(index_path)])

        print(f"Running RVC command: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        
        # Fallback Echo removed. Real RVC only.
        # ------------------------
        
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Conversion failed: Output file not created")

        # 4. Return audio
        with open(output_path, "rb") as f:
            audio_data = f.read()

        return Response(content=audio_data, media_type="audio/mpeg")

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
