#!/bin/bash
#
# TUS Post-Finish Hook Script for 3Speak Upload Service
# 
# This script is called by the TUS server when an upload completes.
# It sends the upload information to the 3Speak upload service callback endpoint.
#
# Setup Instructions:
# 1. Copy this script to your TUS hooks directory
# 2. Make it executable: chmod +x post-finish
# 3. Update the CALLBACK_URL if needed
# 4. Start TUS server with: tusd -hooks-dir /path/to/hooks -hooks-enabled-events post-finish
#

# Configuration
CALLBACK_URL="http://localhost:8080/api/upload/tus-callback"
TIMEOUT=30

# Log function
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Debug: Log all TUS environment variables
log_message "DEBUG: TUS Environment Variables:"
env | grep TUS | while read line; do
    log_message "  $line"
done

# Validate environment variables
if [[ -z "$TUS_ID" || -z "$TUS_SIZE" ]]; then
    log_message "ERROR: Required TUS environment variables not set (TUS_ID or TUS_SIZE missing)"
    exit 1
fi

# Construct file path (TUS_FILE might not be set in newer versions)
if [[ -z "$TUS_FILE" ]]; then
    # TUS stores files without extension, just the ID
    TUS_FILE="/tmp/uploads/${TUS_ID}"
    log_message "TUS_FILE not set, using constructed path: $TUS_FILE"
fi

# Try to read metadata from .info file
INFO_FILE="/tmp/uploads/${TUS_ID}.info"
if [[ -f "$INFO_FILE" ]]; then
    log_message "Reading metadata from info file: $INFO_FILE"
    
    # Parse JSON metadata from .info file
    VIDEO_ID=$(grep -o '"video_id":"[^"]*"' "$INFO_FILE" | cut -d'"' -f4)
    OWNER=$(grep -o '"owner":"[^"]*"' "$INFO_FILE" | cut -d'"' -f4)
    PERMLINK=$(grep -o '"permlink":"[^"]*"' "$INFO_FILE" | cut -d'"' -f4)
    
    log_message "Extracted from info file: video_id=$VIDEO_ID, owner=$OWNER, permlink=$PERMLINK"
else
    log_message "No .info file found, trying environment variables"
    
    # Extract metadata from environment (fallback)
    VIDEO_ID="${TUS_META_VIDEO_ID}"
    OWNER="${TUS_META_OWNER}" 
    PERMLINK="${TUS_META_PERMLINK}"
fi

# Validate metadata
if [[ -z "$VIDEO_ID" || -z "$OWNER" || -z "$PERMLINK" ]]; then
    log_message "ERROR: Required metadata not provided: video_id=$VIDEO_ID, owner=$OWNER, permlink=$PERMLINK"
    log_message "Available metadata keys: $(env | grep TUS_META | cut -d= -f1 | tr '\n' ' ')"
    exit 1
fi

# Check if file exists
if [[ ! -f "$TUS_FILE" ]]; then
    log_message "ERROR: Upload file not found: $TUS_FILE"
    exit 1
fi

# Get file size
FILE_SIZE=$(stat -f%z "$TUS_FILE" 2>/dev/null || stat -c%s "$TUS_FILE" 2>/dev/null)

log_message "Processing upload completion:"
log_message "  Upload ID: $TUS_ID"
log_message "  File: $TUS_FILE"
log_message "  Size: $FILE_SIZE bytes"
log_message "  Video ID: $VIDEO_ID"
log_message "  Owner: $OWNER"
log_message "  Permlink: $PERMLINK"

# Prepare callback payload
UPLOAD_DATA=$(cat <<EOF
{
  "Upload": {
    "ID": "$TUS_ID",
    "Storage": {
      "Path": "$TUS_FILE"
    },
    "MetaData": {
      "video_id": "$VIDEO_ID",
      "owner": "$OWNER",
      "permlink": "$PERMLINK"
    }
  }
}
EOF
)

# Send callback to upload service
log_message "Sending callback to: $CALLBACK_URL"

HTTP_STATUS=$(curl -w "%{http_code}" -o /tmp/tus_callback_response.txt \
  --max-time "$TIMEOUT" \
  --retry 3 \
  --retry-delay 2 \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$UPLOAD_DATA" \
  "$CALLBACK_URL" 2>/dev/null)

CURL_EXIT_CODE=$?

if [[ $CURL_EXIT_CODE -eq 0 && "$HTTP_STATUS" =~ ^2[0-9][0-9]$ ]]; then
    log_message "SUCCESS: Callback sent successfully (HTTP $HTTP_STATUS)"
    
    # Log response if needed
    if [[ -s /tmp/tus_callback_response.txt ]]; then
        RESPONSE_BODY=$(cat /tmp/tus_callback_response.txt)
        log_message "Response: $RESPONSE_BODY"
    fi
    
    # Cleanup response file
    rm -f /tmp/tus_callback_response.txt
    
    exit 0
else
    log_message "ERROR: Callback failed (curl exit: $CURL_EXIT_CODE, HTTP: $HTTP_STATUS)"
    
    # Log error response
    if [[ -s /tmp/tus_callback_response.txt ]]; then
        ERROR_RESPONSE=$(cat /tmp/tus_callback_response.txt)
        log_message "Error response: $ERROR_RESPONSE"
    fi
    
    # Cleanup response file
    rm -f /tmp/tus_callback_response.txt
    
    exit 1
fi