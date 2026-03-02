#!/bin/sh
# run-job.sh - Cron job runner
# Usage: /run-job.sh <job-name> <url>
JOB_NAME="$1"
URL="$2"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Running job: $JOB_NAME -> $URL"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 55 "$URL")
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Job $JOB_NAME done. HTTP $RESPONSE"
