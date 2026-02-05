#!/bin/bash
# Script pour déployer les corrections sur le serveur Baileys

echo "🚀 Deploying Baileys fixes..."

# Configuration
SERVER_IP="13.60.16.81"
SERVER_USER="ubuntu"
REMOTE_DIR="/opt/baileys"
LOCAL_DIR="./services/baileys"

echo "📤 Syncing files to server..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'auth' \
  --exclude '*.log' \
  "$LOCAL_DIR/" \
  "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo "🔄 Restarting Baileys service..."
ssh "$SERVER_USER@$SERVER_IP" << 'EOF'
  cd /opt/baileys
  
  # Install dependencies if needed
  npm install
  
  # Build TypeScript
  npm run build
  
  # Restart with PM2 (or whatever process manager you use)
  if command -v pm2 &> /dev/null; then
    pm2 restart baileys || pm2 start dist/index.js --name baileys
  else
    # Kill existing node process and restart
    pkill -f "node dist/index.js" || true
    nohup node dist/index.js > baileys.log 2>&1 &
  fi
  
  echo "✅ Baileys restarted"
EOF

echo "✅ Deployment complete!"
echo ""
echo "Test commands:"
echo "  curl http://$SERVER_IP:3001/health"
echo "  curl http://$SERVER_IP:3001/api/logs?lines=10"
