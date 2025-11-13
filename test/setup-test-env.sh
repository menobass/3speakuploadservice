#!/bin/bash

# 3Speak Local Upload Testing Environment Setup

echo "🚀 Setting up 3Speak Upload Testing Environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️ No .env file found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${RED}❗ IMPORTANT: Edit .env with your MongoDB connections and auth token!${NC}"
    echo ""
fi

# Check if TUS binary exists
if [ ! -f "tusd_linux_amd64/tusd" ]; then
    echo -e "${RED}❌ TUS server binary not found. Run the download script first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ TUS server binary found${NC}"

# Check hooks directory
if [ ! -d "/tmp/tus-hooks" ] || [ ! -f "/tmp/tus-hooks/post-finish" ]; then
    echo -e "${YELLOW}⚠️ Setting up TUS hooks...${NC}"
    mkdir -p /tmp/tus-hooks
    cp scripts/tus-post-finish-hook.sh /tmp/tus-hooks/post-finish
    chmod +x /tmp/tus-hooks/post-finish
fi

echo -e "${GREEN}✅ TUS hooks configured${NC}"

# Create uploads directory
mkdir -p /tmp/uploads
echo -e "${GREEN}✅ Upload directory created${NC}"

echo ""
echo -e "${GREEN}🎉 Setup complete! Now start the services:${NC}"
echo ""
echo -e "${YELLOW}Terminal 1 - Start TUS Server:${NC}"
echo "./tusd_linux_amd64/tusd -upload-dir /tmp/uploads -hooks-dir /tmp/tus-hooks -hooks-enabled-events post-finish -port 1080 -verbose"
echo ""
echo -e "${YELLOW}Terminal 2 - Start Upload Service:${NC}"
echo "npm run dev"
echo ""
echo -e "${YELLOW}Terminal 3 - Test Upload:${NC}"
echo "curl http://localhost:8080/health"
echo ""
echo -e "${GREEN}📋 Then use the test commands in LOCAL_SETUP.md${NC}"