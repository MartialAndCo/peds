#!/bin/bash
set -e

echo "=== Verify .env NEXTAUTH_URL ==="
grep NEXTAUTH_URL /root/peds/.env

echo ""
echo "=== Delete and recreate PM2 process to force env reload ==="
cd /root/peds
/root/.nvm/versions/node/v22.22.0/bin/pm2 delete peds
/root/.nvm/versions/node/v22.22.0/bin/pm2 start npm --name "peds" -- run start
/root/.nvm/versions/node/v22.22.0/bin/pm2 save

echo ""
echo "=== Wait for startup ==="
sleep 3

echo ""
echo "=== Verify port binding ==="
ss -ltnp | grep 3005

echo ""
echo "=== Test redirect URL ==="
curl -s -o /dev/null -w "HTTP %{http_code} -> %{redirect_url}" https://peds.89-167-94-105.nip.io/admin

echo ""
echo "=== DONE ==="
