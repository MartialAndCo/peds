#!/bin/sh

JOB_NAME="$1"
URL="$2"

# Timestamp format
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Execute curl silently (-s), fail on HTTP error (-f), and capture output
# We capture both stdout and stderr
RESPONSE=$(curl -s -f "$URL" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # Success
    echo "[$TIMESTAMP] [SUCCESS] $JOB_NAME"
    # Optional: Log response if needed, or keep it clean
    # echo "  Response: $RESPONSE"
else
    # Error
    echo "[$TIMESTAMP] [ERROR] $JOB_NAME - Exit Code: $EXIT_CODE"
    echo "  Details: $RESPONSE"
fi
