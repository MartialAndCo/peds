#!/bin/bash
set -e

echo "=== Restoring clean Caddyfile ==="
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
89-167-94-105.nip.io {
	reverse_proxy 127.0.0.1:8000
}

waha.89-167-94-105.nip.io {
	reverse_proxy 127.0.0.1:3000
}

peds.89-167-94-105.nip.io {
	reverse_proxy 127.0.0.1:3005
}

openclaw.89-167-94-105.nip.io {
	reverse_proxy 127.0.0.1:18789
}

openclaw-browser.89-167-94-105.nip.io {
	reverse_proxy 127.0.0.1:18791
}
CADDYEOF

caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

echo "=== Test direct via localhost (bypassing Caddy) ==="
curl -sI http://127.0.0.1:3005/admin 2>&1 | grep -i location

echo "=== Test via Caddy ==="
curl -sI https://peds.89-167-94-105.nip.io/admin 2>&1 | grep -i location

echo "=== DONE ==="
