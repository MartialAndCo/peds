#!/bin/bash
set -e

cd /root/peds

echo "=== Rebuilding Next.js ==="
export PATH="/root/.nvm/versions/node/v22.22.0/bin:$PATH"
npm run build 2>&1 | tail -20

echo ""
echo "=== Restarting PM2 ==="
pm2 delete peds || true
pm2 start npm --name "peds" -- run start
pm2 save

sleep 3

echo ""
echo "=== Test redirect ==="
curl -s -o /dev/null -w "HTTP %{http_code} -> %{redirect_url}" https://peds.89-167-94-105.nip.io/admin

echo ""
echo "=== DONE ==="
