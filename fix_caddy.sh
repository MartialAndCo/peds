#!/bin/bash
set -e

echo "=== Current Caddyfile ==="
cat /etc/caddy/Caddyfile

echo ""
echo "=== Fixing reverse_proxy to use 127.0.0.1 ==="
sed -i 's/reverse_proxy localhost:/reverse_proxy 127.0.0.1:/g' /etc/caddy/Caddyfile

echo ""
echo "=== Updated Caddyfile ==="
cat /etc/caddy/Caddyfile

echo ""
echo "=== Validating ==="
caddy validate --config /etc/caddy/Caddyfile

echo ""
echo "=== Reloading Caddy ==="
systemctl reload caddy

echo ""
echo "=== Caddy status ==="
systemctl status caddy --no-pager | head -10

echo "=== DONE ==="
