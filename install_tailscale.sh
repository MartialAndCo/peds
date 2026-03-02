curl -fsSL https://tailscale.com/install.sh | sh
echo "--- Tailscale installed ---"
tailscale version
echo "--- Run 'tailscale up' to authenticate ---"
tailscale up --ssh
