#!/bin/bash

# PostgreSQL Restore Script
# Restores database from a backup file

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

# ============================================
# LOGGING FUNCTIONS
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# ============================================
# RESTORE FUNCTION
# ============================================

list_backups() {
    log "Available backups:"
    echo ""
    
    # List all backup files with details
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -printf "%T@ %Tc %p\n" | sort -rn | nl -w2 -s'. ' | cut -d' ' -f1-2,8-
}

restore_backup() {
    local BACKUP_FILE="$1"
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log "=========================================="
    log "PostgreSQL Restore Started"
    log "=========================================="
    log "Backup file: $BACKUP_FILE"
    log "Database: $DB_NAME"
    log "Host: $DB_HOST:$DB_PORT"
    
    # Warning
    echo ""
    echo "⚠️  WARNING: This will REPLACE all data in the database!"
    echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
    
    # Set password
    export PGPASSWORD="$DB_PASSWORD"
    
    log "Dropping existing database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    log "Creating fresh database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
    
    log "Restoring backup..."
    if gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; then
        log "Restore completed successfully!"
    else
        log_error "Restore failed!"
        unset PGPASSWORD
        exit 1
    fi
    
    unset PGPASSWORD
    
    log "=========================================="
    log "Restore Completed Successfully"
    log "=========================================="
}

# ============================================
# MAIN EXECUTION
# ============================================

main() {
    if [ -z "$1" ]; then
        # No argument provided - show list of backups
        list_backups
        echo ""
        echo "Usage: $0 <backup_file>"
        echo "Example: $0 /var/backups/postgresql/backup_postgres_20260127_020000.sql.gz"
        echo ""
        echo "Or use the latest backup:"
        LATEST_BACKUP=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -printf "%T@ %p\n" | sort -rn | head -1 | cut -d' ' -f2)
        if [ -n "$LATEST_BACKUP" ]; then
            echo "$0 $LATEST_BACKUP"
        fi
        exit 0
    fi
    
    restore_backup "$1"
}

# Run main function
main "$@"
