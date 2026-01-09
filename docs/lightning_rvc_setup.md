
# Lightning AI RVC Setup Guide

## 1. Local SSH Configuration
You have provided the connection string. Run this in your local terminal (Git Bash or similar on Windows, or Terminal on Mac/Linux) to configure your SSH keys:

```bash
curl -s "https://lightning.ai/setup/ssh?t=7f99be1b-d08a-492a-aa33-101c003c6a49&s=01kea78sgzhjfybfhnrcf5nhgm" | bash
```

Test valid connection:
```bash
ssh lightning
# OR whatever Host alias was created, check ~/.ssh/config.
# Usually it's 'ssh lighting-users-<id>' or similar. 
# Check the output of the curl command for the exact 'ssh <hostname>' command.
```

## 2. Deploy Code to Lightning Studio
From your `peds` directory, copy the server files to the remote machine:

```bash
# Replace 'your-lightning-host' with the actual Host from your ssh config
scp -r lightning_rvc/* your-lightning-host:~/
```

## 3. Setup Remote Environment
SSH into the machine:
```bash
ssh your-lightning-host
```

Inside the Lightning Studio terminal:
```bash
# 1. Install Dependencies
cd lightning_rvc
pip install -r requirements.txt

# 2. Install RVC (If not covered by requirements)
# You might need to clone the RVC repo or install a specific wheel per documentation
# pip install rvc-python

# 3. Download Models
# Place your .pth and .index files in the 'weights' and 'indices' folders respectively.
mkdir -p weights indices
# (Upload your trained voice models here)
```

## 4. Run the Server
```bash
python server.py
```
The server will start on port 8000.

## 5. Expose Port (Tunneling)
Since `peds` runs locally and Lightning is remote, you need to reach it.
Option A: **SSH Tunnel** (Recommended for dev)
Open a new local terminal and run:
```bash
ssh -L 8000:localhost:8000 your-lightning-host
```
Now `http://localhost:8000` on your PC forwards to the Lightning server.

Option B: **Public URL**
Use the Lightning AI Studio's "Expose Port" feature if available to get a public https URL.
