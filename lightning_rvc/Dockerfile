
# Base image with Python and CUDA
# RunPod officially recommends these base images
FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime

# System dependencies
# ffmpeg is required for audio processing
RUN apt-get update && \
    apt-get install -y ffmpeg libsndfile1 git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Working Directory
WORKDIR /app

# Install Python Dependencies
# rvc-python: Wrapper for RVC
# runpod: SDK for serverless
RUN pip install --no-cache-dir \
    runpod \
    rvc-python \
    requests \
    scipy \
    tensorboard \
    praat-parselmouth \
    pyworld \
    faiss-gpu

# Copy Handler
COPY handler.py .

# Trigger the handler
CMD [ "python", "-u", "handler.py" ]
