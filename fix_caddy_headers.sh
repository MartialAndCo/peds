#!/bin/bash
set -e

echo "=== Updating Caddyfile with proper header forwarding ==="
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
89-167-94-105.nip.io {
    reverse_proxy 127.0.0.1:8000
}

waha.89-167-94-105.nip.io {
    reverse_proxy 127.0.0.1:3000
}

peds.89-167-94-105.nip.io {
    reverse_proxy 127.0.0.1:3005 {
        header_up Host {upstream_hostport}
        header_up X-Forwarded-Host {host}
    }
}

openclaw.89-167-94-105.nip.io {
    reverse_proxy 127.0.0.1:18789
}

openclaw-browser.89-167-94-105.nip.io {
    reverse_proxy 127.0.0.1:18791
}
CADDYEOF

echo "=== Validate ==="
caddy validate --config /etc/caddy/Caddyfile

echo "=== Reload ==="
systemctl reload caddy

echo "=== Test redirect ==="
sleep 1
curl -sI https://peds.89-167-94-105.nip.io/admin 2>&1 | grep -i location

echo "=== DONE ==="
