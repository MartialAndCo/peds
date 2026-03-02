#!/bin/bash
set -e

echo "=== Removing global SSH allow rules ==="
# Delete the global 22/tcp allow rules (keep only tailscale0 + specific IP)
ufw delete allow 22/tcp

echo "=== Also remove 443/udp if not needed ==="
ufw delete allow 443/udp

echo "=== Current rules ==="
ufw status numbered
