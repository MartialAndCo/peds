#!/bin/bash

# Setup PostgreSQL Backup Cron Job
# This script configures automatic backups every 3 hours

set -e

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"
ENV_FILE="$PROJECT_ROOT/.env"

# ============================================
# FUNCTIONS
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# ============================================
# VALIDATION
# ============================================

log "Validating setup..."

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    log_error "Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"
log "Backup script is executable: $BACKUP_SCRIPT"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env file not found: $ENV_FILE"
    log_error "Please create .env file with database credentials"
    exit 1
fi

# ============================================
# CREATE CRON WRAPPER SCRIPT
# ============================================

log "Creating cron wrapper script..."

CRON_WRAPPER="$SCRIPT_DIR/backup-cron-wrapper.sh"

cat > "$CRON_WRAPPER" << 'EOF'
#!/bin/bash

# Cron wrapper for database backup
# Loads environment variables and runs backup script

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables from .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Extract DATABASE_URL components if present
if [ -n "$DATABASE_URL" ]; then
    # Parse PostgreSQL connection string
    # Format: postgresql://user:password@host:port/database
    
    # Extract using regex
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)(\?.*)?$ ]]; then
        export DB_USER="${BASH_REMATCH[1]}"
        export DB_PASSWORD="${BASH_REMATCH[2]}"
        export DB_HOST="${BASH_REMATCH[3]}"
        export DB_PORT="${BASH_REMATCH[4]}"
        export DB_NAME="${BASH_REMATCH[5]}"
    fi
fi

# Run backup script
"$SCRIPT_DIR/backup-database.sh"
EOF

chmod +x "$CRON_WRAPPER"
log "Cron wrapper created: $CRON_WRAPPER"

# ============================================
# SETUP CRON JOB
# ============================================

log "Setting up cron job..."

# Cron schedule: Every 3 hours (at 0:00, 3:00, 6:00, 9:00, 12:00, 15:00, 18:00, 21:00)
CRON_SCHEDULE="0 */3 * * *"

# Create cron job entry
CRON_JOB="$CRON_SCHEDULE $CRON_WRAPPER >> /var/log/postgresql-backups/cron.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$CRON_WRAPPER"; then
    log "Cron job already exists. Removing old entry..."
    crontab -l 2>/dev/null | grep -v "$CRON_WRAPPER" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

log "Cron job added successfully!"
log "Schedule: Every 3 hours (0:00, 3:00, 6:00, 9:00, 12:00, 15:00, 18:00, 21:00)"

# ============================================
# CREATE LOG DIRECTORY
# ============================================

sudo mkdir -p /var/log/postgresql-backups
sudo chown $USER:$USER /var/log/postgresql-backups

log "Log directory created: /var/log/postgresql-backups"

# ============================================
# CREATE BACKUP DIRECTORY
# ============================================

sudo mkdir -p /var/backups/postgresql
sudo chown $USER:$USER /var/backups/postgresql

log "Backup directory created: /var/backups/postgresql"

# ============================================
# TEST BACKUP
# ============================================

log ""
log "=========================================="
log "Setup Complete!"
log "=========================================="
log ""
log "Cron job configured to run every 3 hours"
log "Backup directory: /var/backups/postgresql"
log "Log directory: /var/log/postgresql-backups"
log ""
log "To verify cron job:"
log "  crontab -l"
log ""
log "To run a manual backup now:"
log "  $CRON_WRAPPER"
log ""
log "To view backup logs:"
log "  tail -f /var/log/postgresql-backups/cron.log"
log ""

read -p "Would you like to run a test backup now? (yes/no): " RUN_TEST

if [ "$RUN_TEST" = "yes" ]; then
    log "Running test backup..."
    "$CRON_WRAPPER"
fi
