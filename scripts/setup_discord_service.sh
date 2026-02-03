#!/bin/bash

# Setup Discord Service on EC2
# Automated script to fetch, install, and run the Discord selfbot

set -e

# ============================================
# CONFIGURATION
# ============================================

# Directory structure
BASE_DIR="/home/ubuntu"
PROJECT_DIR="$BASE_DIR/peds"
SERVICE_DIR="$PROJECT_DIR/services/discord"

# Log function
log() {
    echo -e "\e[32m[$(date '+%Y-%m-%d %H:%M:%S')] $1\e[0m"
}

error() {
    echo -e "\e[31m[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1\e[0m" >&2
}

# ============================================
# 1. PRE-FLIGHT CHECKS
# ============================================

log "Starting Discord Service Setup..."

# Check requirements
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js (v18+) first."
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    log "PM2 not found. Installing global PM2..."
    npm install -g pm2
fi

# ============================================
# 2. UPDATE REPOSITORY
# ============================================

log "Updating repository..."
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    git pull origin main
else
    log "Cloning repository..."
    git clone https://github.com/MartialAndCo/peds.git "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# ============================================
# 3. INSTALL SERVICE
# ============================================

log "Installing Discord Service dependencies..."
cd "$SERVICE_DIR"
npm ci --only=production

# Compile TypeScript
log "Building service..."
npm run build || log "Build script might be missing, assuming raw TS or pre-built."

# ============================================
# 4. CONFIGURE ENV
# ============================================

if [ ! -f ".env" ]; then
    log "Creating .env file..."
    read -p "Enter DISCORD_TOKEN: " DISCORD_TOKEN
    
    cat > .env << EOF
DISCORD_TOKEN=$DISCORD_TOKEN
WEBHOOK_URL=https://main.d2in5shy58lp10.amplifyapp.com/api/webhooks/discord
PORT=3002
EOF
    log ".env file created."
else
    log ".env file already exists. Keeping it."
fi

# ============================================
# 5. START WITH PM2
# ============================================

log "Starting/Restarting service with PM2..."

# Check if already running
if pm2 list | grep -q "discord-bot"; then
    pm2 restart discord-bot
else
    pm2 start dist/index.js --name "discord-bot"
fi

pm2 save
pm2 startup | grep -v "skipping" || true

log "=========================================="
log "Setup Complete! Discord Bot is running."
log "Monitor logs with: pm2 logs discord-bot"
log "=========================================="
