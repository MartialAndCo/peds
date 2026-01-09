# Manual Setup for Lightning AI + RVC

Since the automated setup encountered environment issues, here is the clean way to set it up directly in your Lightning AI Studio terminal.

## 1. Open Terminal in Studio
Go to [https://lightning.ai/studios](https://lightning.ai/studios), open your studio, and open a terminal.

## 2. Clean & Prepare Dependencies
Run these commands to verify the environment and install RVC.

```bash
# 1. Create a clean Conda environment (Python 3.10 is best for RVC)
conda create -n rvc python=3.10 -y
conda activate rvc

# 2. Clone the RVC WebUI Repository
git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git
cd Retrieval-based-Voice-Conversion-WebUI

# 3. Install Dependencies
pip install -r requirements.txt
pip install gradio
```

## 3. Start the WebUI (For you to use)
This will let you manage models and test voice conversion visually.
```bash
python infer-web.py --port 7865 --listen
```
*You can access this UI if you forward port 7865 via SSH, or use the Lightning Studio "Open Port" feature if available.*

## 4. Prepare for the WhatsApp Bot
For the bot to work, we just need `rvc-python` accessible.
In a **new terminal tab** (inside the Studio):

```bash
conda activate rvc
pip install rvc-python fastapi uvicorn python-multipart
```

**That's it.** Once you have done this, I (the bot) can take over to run the API server that connects to WhatsApp.
