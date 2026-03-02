#!/bin/bash
set -e

echo "=== Step 1: Install UFW ==="
apt-get update -qq && apt-get install -y -qq ufw

echo "=== Step 2: Set defaults ==="
ufw default deny incoming
ufw default allow outgoing

echo "=== Step 3: Allow SSH on Tailscale interface FIRST (safety net) ==="
ufw allow in on tailscale0 to any port 22 proto tcp

echo "=== Step 4: Allow SSH from current public IP as backup ==="
ufw allow from 212.15.80.178 to any port 22 proto tcp

echo "=== Step 5: Allow HTTP/HTTPS for Caddy (public) ==="
ufw allow 80/tcp
ufw allow 443/tcp

echo "=== Step 6: Allow Tailscale UDP port ==="
ufw allow 41641/udp

echo "=== Step 7: Enable UFW (non-interactive) ==="
echo "y" | ufw enable

echo "=== Step 8: Verify ==="
ufw status verbose

echo "=== DONE ==="
