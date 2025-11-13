#!/bin/bash

# Complete 3Speak Upload Test Script
# This demonstrates a full video upload to the real 3Speak system

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🎬 3Speak Local Upload Test${NC}"
echo "=================================="

# Configuration
UPLOAD_SERVICE_URL="http://localhost:8080"
AUTH_TOKEN="test-secret-token-change-in-production-123456789"
HIVE_USERNAME="your-username-here"

# Check if upload service is running
echo -e "${YELLOW}📡 Checking upload service...${NC}"
if ! curl -f -s "$UPLOAD_SERVICE_URL/health" > /dev/null; then
    echo -e "${RED}❌ Upload service not running at $UPLOAD_SERVICE_URL${NC}"
    echo "Start it with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Upload service is running${NC}"

# Check if TUS server is running
echo -e "${YELLOW}📤 Checking TUS server...${NC}"
if ! curl -f -s "http://localhost:1080" > /dev/null; then
    echo -e "${RED}❌ TUS server not running at http://localhost:1080${NC}"
    echo "Start it with: ./tusd_linux_amd64/tusd -upload-dir /tmp/uploads -hooks-dir /tmp/tus-hooks -hooks-enabled-events post-finish -port 1080 -verbose"
    exit 1
fi
echo -e "${GREEN}✅ TUS server is running${NC}"

# Create a test video file if it doesn't exist
TEST_VIDEO="test_video.mp4"
if [ ! -f "$TEST_VIDEO" ]; then
    echo -e "${YELLOW}📹 Creating test video file...${NC}"
    # Create a small test video using ffmpeg (if available) or just a dummy file
    if command -v ffmpeg &> /dev/null; then
        ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=1 -f lavfi -i sine=frequency=1000:duration=10 -c:v libx264 -t 10 -pix_fmt yuv420p "$TEST_VIDEO" -y &> /dev/null
        echo -e "${GREEN}✅ Created test video with ffmpeg${NC}"
    else
        # Create a dummy file for testing
        dd if=/dev/urandom of="$TEST_VIDEO" bs=1024 count=1000 &> /dev/null
        echo -e "${YELLOW}⚠️ Created dummy test file (no ffmpeg found)${NC}"
    fi
fi

VIDEO_SIZE=$(stat -c%s "$TEST_VIDEO" 2>/dev/null || stat -f%z "$TEST_VIDEO" 2>/dev/null)
echo -e "${BLUE}📊 Test video: $TEST_VIDEO ($VIDEO_SIZE bytes)${NC}"

# Step 1: Prepare Upload
echo ""
echo -e "${YELLOW}📋 Step 1: Preparing upload...${NC}"

PREPARE_RESPONSE=$(curl -s -X POST "$UPLOAD_SERVICE_URL/api/upload/prepare" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"owner\": \"$HIVE_USERNAME\",
    \"title\": \"Local Test Video - $(date)\",
    \"description\": \"This is a test video uploaded from the local development environment. It demonstrates the complete upload flow to 3Speak's IPFS supernode.\",
    \"tags\": [\"test\", \"development\", \"upload\"],
    \"duration\": 10.0,
    \"size\": $VIDEO_SIZE,
    \"originalFilename\": \"$TEST_VIDEO\",
    \"community\": \"hive-181335\"
  }")

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Failed to prepare upload${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Upload prepared${NC}"
echo "$PREPARE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PREPARE_RESPONSE"

# Extract video ID and upload URL from response
VIDEO_ID=$(echo "$PREPARE_RESPONSE" | grep -o '"video_id":"[^"]*"' | cut -d'"' -f4)
TUS_ENDPOINT=$(echo "$PREPARE_RESPONSE" | grep -o '"tus_endpoint":"[^"]*"' | cut -d'"' -f4)
PERMLINK=$(echo "$PREPARE_RESPONSE" | grep -o '"permlink":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$VIDEO_ID" ]] || [[ -z "$TUS_ENDPOINT" ]]; then
    echo -e "${RED}❌ Failed to extract upload info from response${NC}"
    exit 1
fi

echo -e "${BLUE}📝 Video ID: $VIDEO_ID${NC}"
echo -e "${BLUE}📝 Permlink: $PERMLINK${NC}"
echo -e "${BLUE}📝 TUS Endpoint: $TUS_ENDPOINT${NC}"

# Step 2: Upload via TUS
echo ""
echo -e "${YELLOW}📤 Step 2: Uploading video via TUS...${NC}"

# Create TUS upload
TUS_UPLOAD_RESPONSE=$(curl -s -X POST "$TUS_ENDPOINT" \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Length: $VIDEO_SIZE" \
  -H "Upload-Metadata: video_id $(echo -n "$VIDEO_ID" | base64 -w 0),owner $(echo -n "$HIVE_USERNAME" | base64 -w 0),permlink $(echo -n "$PERMLINK" | base64 -w 0)" \
  -I)

UPLOAD_URL=$(echo "$TUS_UPLOAD_RESPONSE" | grep -i "location:" | cut -d' ' -f2 | tr -d '\r')

if [[ -z "$UPLOAD_URL" ]]; then
    echo -e "${RED}❌ Failed to create TUS upload${NC}"
    echo "$TUS_UPLOAD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ TUS upload created: $UPLOAD_URL${NC}"

# Upload the actual file
echo -e "${YELLOW}📁 Uploading file data...${NC}"
curl -s -X PATCH "$UPLOAD_URL" \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Offset: 0" \
  -H "Content-Type: application/offset+octet-stream" \
  --data-binary "@$TEST_VIDEO"

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Failed to upload file data${NC}"
    exit 1
fi

echo -e "${GREEN}✅ File uploaded successfully${NC}"
echo -e "${YELLOW}⏳ TUS hook should now trigger the callback...${NC}"

# Step 3: Check Status
echo ""
echo -e "${YELLOW}📊 Step 3: Checking upload status...${NC}"

# Wait a moment for processing
sleep 3

STATUS_RESPONSE=$(curl -s -X GET "$UPLOAD_SERVICE_URL/api/upload/video/$VIDEO_ID/status" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo -e "${GREEN}✅ Current status:${NC}"
echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"

# Extract IPFS hash if available
IPFS_HASH=$(echo "$STATUS_RESPONSE" | grep -o '"filename":"ipfs://[^"]*"' | cut -d'/' -f3 | tr -d '"')

if [[ -n "$IPFS_HASH" ]]; then
    echo ""
    echo -e "${GREEN}🎉 SUCCESS! Video uploaded to IPFS!${NC}"
    echo -e "${BLUE}📎 IPFS Hash: $IPFS_HASH${NC}"
    echo -e "${BLUE}🌐 3Speak URL: https://ipfs.3speak.tv/ipfs/$IPFS_HASH${NC}"
    echo -e "${BLUE}📺 Video will appear on 3Speak as: $HIVE_USERNAME/$PERMLINK${NC}"
    echo ""
    echo -e "${GREEN}✨ This is a REAL video that will be encoded by 3Speak's system!${NC}"
else
    echo -e "${YELLOW}⏳ Upload still processing... Check status again in a few moments${NC}"
fi

# Cleanup test file
if [[ "$TEST_VIDEO" == "test_video.mp4" ]]; then
    rm -f "$TEST_VIDEO"
fi

echo ""
echo -e "${BLUE}🏁 Test complete!${NC}"