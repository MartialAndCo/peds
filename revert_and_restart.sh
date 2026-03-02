#!/bin/bash
set -e

cd /root/peds

echo "=== Revert start script ==="
python3 /tmp/_remote_script.py

echo "=== Restart PM2 ==="
export PATH="/root/.nvm/versions/node/v22.22.0/bin:$PATH"
pm2 delete peds || true
pm2 start npm --name "peds" -- run start
pm2 save

sleep 3

echo "=== Verify port ==="
ss -ltnp | grep 3005

echo "=== Test redirect ==="
curl -sI https://peds.89-167-94-105.nip.io/admin 2>&1 | grep -i location

echo "=== DONE ==="
