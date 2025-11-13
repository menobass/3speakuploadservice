# Local 3Speak Upload Testing Environment

## 🚀 COMPLETE Setup Guide

This will set up a **complete local environment that uploads REAL videos to 3Speak**!

## Prerequisites

You'll need:
- **MongoDB access** to 3Speak databases (contact 3Speak team)
- **Your Hive username** for uploads
- **Internet connection** to 3Speak IPFS supernode

## One-Command Setup

```bash
# Run the automated setup
./setup-test-env.sh
```

Or follow manual steps below:

### 1. Configure Environment

```bash
# Copy test configuration
cp .env.test .env

# Edit with your details
nano .env
```

**Required changes in `.env`:**
- `MONGO_URI` - 3Speak MongoDB connection
- `ENCODER_MONGO_URI` - Encoder MongoDB connection  
- `UPLOAD_SECRET_TOKEN` - Your secret (keep the test one for now)

### 2. TUS Server Setup (Already Done!)

The TUS binary is downloaded and configured. Hooks are ready.

### 3. Start Services

**Terminal 1 - TUS Server:**
```bash
./tusd_linux_amd64/tusd -upload-dir /tmp/uploads -hooks-dir /tmp/tus-hooks -hooks-enabled-events post-finish -port 1080 -verbose
```

**Terminal 2 - Upload Service:**
```bash
npm run dev
```

### 4. Test Everything! 

**Terminal 3 - Run Complete Test:**
```bash
# Edit your Hive username in the script first
nano test-upload.sh

# Run complete upload test
./test-upload.sh
```

This script will:
1. ✅ Check both services are running
2. 📹 Create a test video file
3. 📋 Prepare upload (creates 3Speak video entry)
4. 📤 Upload via TUS (triggers callback)
5. 🌐 Upload to IPFS supernode (65.21.201.94:5002)
6. 📊 Show final status with IPFS hash

**Manual Test Commands:**

```bash
# 1. Health check
curl http://localhost:8080/health

# 2. Prepare upload  
curl -X POST http://localhost:8080/api/upload/prepare \
  -H "Authorization: Bearer test-secret-token-change-in-production-123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "your-hive-username", 
    "title": "My Test Video",
    "description": "Testing local upload",
    "tags": ["test"],
    "duration": 30,
    "size": 5000000,
    "originalFilename": "test.mp4"
  }'

# 3. Check status (use video_id from prepare response)
curl -X GET http://localhost:8080/api/upload/video/VIDEO_ID/status \
  -H "Authorization: Bearer test-secret-token-change-in-production-123456789"
```

## What Happens:

1. **Prepare Upload** → Creates video entry in 3Speak MongoDB
2. **TUS Upload** → Uploads file to local temp storage
3. **Hook Triggers** → Calls our callback endpoint
4. **IPFS Upload** → Uploads directly to 3Speak supernode (65.21.201.94:5002)
5. **Job Creation** → Creates real encoding job for 3Speak encoders
6. **Cleanup** → Deletes local temp file immediately

## Result: 

**Real video on 3Speak that will be encoded by their existing system!**

---

## Configuration Needed

You'll need to provide these in your `.env`:

```bash
# Your secret token (make one up)
UPLOAD_SECRET_TOKEN=my-super-secret-token-123

# Real 3Speak MongoDB connections
MONGO_URI=mongodb://username:password@threespeak-mongo-host:27017/threespeak
ENCODER_MONGO_URI=mongodb://username:password@encoder-mongo-host:27017/spk-encoder-gateway

# TUS endpoint (local)
TUS_ENDPOINT=http://localhost:1080/files

# IPFS supernode (already configured)
IPFS_SUPERNODE_URL=http://65.21.201.94:5002
```

The only "blocker" would be getting access to the MongoDB databases. Everything else works out of the box!