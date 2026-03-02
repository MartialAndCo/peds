#!/bin/bash
echo "=== Restart Fail2ban ==="
systemctl restart fail2ban
sleep 2

echo "=== 1. Fail2ban status ==="
fail2ban-client status sshd 2>&1 || echo "Fail2ban sshd jail not ready yet"

echo ""
echo "=== 2. UFW status ==="
ufw status

echo ""
echo "=== 3. Public listening ports (should only be 80, 443, 41641) ==="
ss -ltnp | grep -v "127.0.0.1" | grep -v "::1" | grep -v tailscale

echo ""
echo "=== 4. Tailscale status ==="
tailscale status

echo ""
echo "=== 5. Next.js binding ==="
ss -ltnp | grep 3005

echo ""
echo "=== 6. Site test via Caddy ==="
curl -s -o /dev/null -w "HTTP %{http_code}" https://peds.89-167-94-105.nip.io/ 2>&1 || echo "curl failed"

echo ""
echo "=== VERIFICATION COMPLETE ==="
