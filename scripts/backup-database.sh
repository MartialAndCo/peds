#!/bin/bash

# PostgreSQL Backup Script for Supabase
# Runs every 3 hours via cron
# Keeps backups for 7 days with automatic rotation

set -e  # Exit on error

# ============================================
# CONFIGURATION
# ============================================

# Database connection (from .env or environment variables)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-your_password}"

# Backup directory
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
LOG_DIR="${LOG_DIR:-/var/log/postgresql-backups}"

# Retention policy (in days)
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# ============================================
# SETUP
# ============================================

# Create directories if they don't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# Timestamp for backup file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
LOG_FILE="$LOG_DIR/backup_${TIMESTAMP}.log"

# ============================================
# LOGGING FUNCTIONS
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

# ============================================
# BACKUP FUNCTION
# ============================================

perform_backup() {
    log "Starting PostgreSQL backup..."
    log "Database: $DB_NAME"
    log "Host: $DB_HOST:$DB_PORT"
    log "Backup file: $BACKUP_FILE"
    
    # Set password for pg_dump
    export PGPASSWORD="$DB_PASSWORD"
    
    # Perform backup with compression
    # NOTE: --verbose flag removed to prevent backup corruption
    if pg_dump -h "$DB_HOST" \
               -p "$DB_PORT" \
               -U "$DB_USER" \
               -d "$DB_NAME" \
               --format=plain \
               --no-owner \
               --no-acl \
               2>> "$LOG_FILE" | gzip > "$BACKUP_FILE"; then
        
        # Get backup size
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log "Backup completed successfully!"
        log "Backup size: $BACKUP_SIZE"
        
        # Unset password
        unset PGPASSWORD
        
        return 0
    else
        log_error "Backup failed!"
        unset PGPASSWORD
        return 1
    fi
}

# ============================================
# ROTATION FUNCTION
# ============================================

rotate_backups() {
    log "Starting backup rotation (keeping last $RETENTION_DAYS days)..."
    
    # Find and delete backups older than RETENTION_DAYS
    DELETED_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
    
    if [ "$DELETED_COUNT" -gt 0 ]; then
        log "Deleted $DELETED_COUNT old backup(s)"
    else
        log "No old backups to delete"
    fi
    
    # Count remaining backups
    REMAINING_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | wc -l)
    log "Total backups remaining: $REMAINING_COUNT"
}

# ============================================
# HEALTH CHECK
# ============================================

check_database_connection() {
    log "Checking database connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log "Database connection successful"
        unset PGPASSWORD
        return 0
    else
        log_error "Cannot connect to database"
        unset PGPASSWORD
        return 1
    fi
}

# ============================================
# MAIN EXECUTION
# ============================================

main() {
    log "=========================================="
    log "PostgreSQL Backup Script Started"
    log "=========================================="
    
    # Check database connection
    if ! check_database_connection; then
        log_error "Backup aborted due to connection failure"
        exit 1
    fi
    
    # Perform backup
    if ! perform_backup; then
        log_error "Backup process failed"
        exit 1
    fi
    
    # Rotate old backups
    rotate_backups
    
    log "=========================================="
    log "Backup Script Completed Successfully"
    log "=========================================="
    
    # Rotate log files (keep last 30 days)
    find "$LOG_DIR" -name "backup_*.log" -type f -mtime +30 -delete
}

# Run main function
main
