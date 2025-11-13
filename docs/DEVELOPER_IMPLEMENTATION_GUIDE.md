# 3Speak Developer Implementation Guide

**For:** 3Speak core developers implementing this REST API service  
**Goal:** Deploy this service to replace legacy upload gateway  
**Target:** `video.3speak.tv/demo` (production deployment)

---

## 🎯 What This Service Does

This is a **complete, production-ready replacement** for the legacy 3Speak upload gateway. It:

1. ✅ Creates video entries directly in MongoDB (`threespeak` database)
2. ✅ Uploads files to IPFS supernode (65.21.201.94:5002)
3. ✅ Creates encoding jobs in encoder gateway (`spk-encoder-gateway` database)
4. ✅ Auto-publishes to Hive blockchain
5. ✅ Provides real-time progress tracking
6. ✅ Includes working demo with Hive Keychain authentication

**Zero changes needed to existing encoders or infrastructure.** This is a drop-in replacement.

---

## 📋 Prerequisites You Already Have

- ✅ MongoDB access (3Speak databases)
- ✅ IPFS supernode (65.21.201.94:5002)
- ✅ VPS/server for deployment
- ✅ Domain: `video.3speak.tv`

---

## 🚀 Quick Deployment (30 Minutes)

### Step 1: Clone Repository

```bash
# On your VPS
cd /var/www
git clone <repository-url> 3speak-upload
cd 3speak-upload
```

### Step 2: Install Dependencies

```bash
# Install Node.js 16+ if not already installed
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install npm packages
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

**Required Configuration:**

```bash
# Server
PORT=8080
NODE_ENV=production

# Authentication - CHANGE THIS!
UPLOAD_SECRET_TOKEN=generate-strong-random-token-here

# MongoDB - Use your existing connections
MONGO_URI=mongodb://username:password@your-mongo-host:27017/threespeak
ENCODER_MONGO_URI=mongodb://username:password@your-mongo-host:27017/spk-encoder-gateway

# IPFS Supernode - Already configured for 3Speak
IPFS_SUPERNODE_URL=http://65.21.201.94:5002

# Default Thumbnail (optional - customize if desired)
DEFAULT_THUMBNAIL=QmdU1V8Eefmv5E77Ct6hNG8A3f9b75dZmVS6ZVvw5ynnrn

# 3Speak Infrastructure
THREESPEAK_IPFS_GATEWAY=https://ipfs.3speak.tv

# TUS Configuration
TUS_UPLOAD_PATH=/tmp/uploads
TUS_ENDPOINT=http://localhost:1080/files
```

### Step 4: Setup TUS Server

```bash
# TUS binary is included in tusd_linux_amd64/
# Create hooks directory
sudo mkdir -p /tmp/tus-hooks
sudo cp scripts/tus-post-finish-hook.sh /tmp/tus-hooks/post-finish
sudo chmod +x /tmp/tus-hooks/post-finish

# Create uploads directory
sudo mkdir -p /tmp/uploads
sudo chown www-data:www-data /tmp/uploads
```

### Step 5: Create Systemd Services

**Upload Service:** `/etc/systemd/system/3speak-upload.service`

```ini
[Unit]
Description=3Speak Upload Service
After=network.target mongodb.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/3speak-upload
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**TUS Server:** `/etc/systemd/system/tusd.service`

```ini
[Unit]
Description=TUS Upload Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/3speak-upload
ExecStart=/var/www/3speak-upload/tusd_linux_amd64/tusd \
  -upload-dir /tmp/uploads \
  -hooks-dir /tmp/tus-hooks \
  -hooks-enabled-events post-finish \
  -port 1080 \
  -verbose
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable 3speak-upload tusd
sudo systemctl start 3speak-upload tusd
sudo systemctl status 3speak-upload tusd
```

### Step 6: Configure Nginx

**Add to your `video.3speak.tv` config:**

```nginx
# Upload API
location /api/upload {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Increase timeouts for large uploads
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    
    # Increase body size for uploads
    client_max_body_size 5G;
}

# TUS Upload Endpoint
location /files {
    proxy_pass http://localhost:1080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # TUS requires these
    proxy_request_buffering off;
    client_max_body_size 5G;
    
    # CORS for TUS
    add_header 'Access-Control-Allow-Origin' 'https://video.3speak.tv' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PATCH, DELETE, OPTIONS, HEAD' always;
    add_header 'Access-Control-Allow-Headers' 'Upload-Offset, Upload-Length, Tus-Resumable, Upload-Metadata, Content-Type' always;
    add_header 'Access-Control-Expose-Headers' 'Upload-Offset, Upload-Length, Tus-Resumable, Upload-Metadata, Location' always;
}

# Demo Page
location /demo.html {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Static Assets for Demo
location /css/ {
    proxy_pass http://localhost:8080;
}
location /js/ {
    proxy_pass http://localhost:8080;
}
location /images/ {
    proxy_pass http://localhost:8080;
}

# Health Check
location /health {
    proxy_pass http://localhost:8080;
}
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Test Deployment

```bash
# Health check
curl https://video.3speak.tv/health

# Access demo
# Open browser: https://video.3speak.tv/demo.html
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | Yes | Server port | `8080` |
| `NODE_ENV` | Yes | Environment | `production` |
| `UPLOAD_SECRET_TOKEN` | **Yes** | API authentication token | - |
| `MONGO_URI` | **Yes** | 3Speak main database | - |
| `ENCODER_MONGO_URI` | **Yes** | Encoder gateway database | - |
| `IPFS_SUPERNODE_URL` | No | Primary IPFS node | `http://65.21.201.94:5002` |
| `IPFS_FALLBACK_URL` | No | Backup IPFS node | - |
| `DEFAULT_THUMBNAIL` | No | Default thumbnail CID | `QmdU1V8Eef...` |
| `THREESPEAK_IPFS_GATEWAY` | No | IPFS gateway URL | `https://ipfs.3speak.tv` |
| `TUS_ENDPOINT` | No | TUS server URL | `http://localhost:1080/files` |

### Security Settings

**Rate Limiting (built-in):**
- General API: 100 requests per 15 minutes
- Upload endpoints: 10 uploads per hour per user

**Customize in:** `src/middleware/auth.js`

---

## 📡 API Integration

### For 3Speak Frontend Developers

Replace existing upload calls with these endpoints:

#### 1. Prepare Upload

```javascript
POST https://video.3speak.tv/api/upload/prepare

Headers:
  Authorization: Bearer YOUR_SECRET_TOKEN
  Content-Type: application/json

Body:
{
  "owner": "username",
  "title": "Video Title",
  "description": "Description",
  "tags": ["tag1", "tag2"],
  "size": 123456789,
  "duration": 120,
  "originalFilename": "video.mp4",
  "community": "hive-181335",
  "declineRewards": false
}

Response:
{
  "success": true,
  "data": {
    "video_id": "507f1f77bcf86cd799439011",
    "permlink": "abc123def",
    "owner": "username",
    "metadata": {
      "video_id": "507f1f77bcf86cd799439011",
      "owner": "username",
      "permlink": "abc123def",
      "filename": "video.mp4",
      "filetype": "video/mp4"
    }
  }
}
```

#### 2. Upload Thumbnail (Optional)

```javascript
POST https://video.3speak.tv/api/upload/thumbnail/:video_id

Headers:
  Authorization: Bearer YOUR_SECRET_TOKEN
  Content-Type: multipart/form-data

Body:
  thumbnail: [file]

Response:
{
  "success": true,
  "data": {
    "video_id": "507f1f77bcf86cd799439011",
    "thumbnail": "ipfs://QmXXX...",
    "ipfs_hash": "QmXXX..."
  }
}
```

#### 3. Upload Video via TUS

```javascript
// Use TUS JavaScript client
import * as tus from 'tus-js-client';

const upload = new tus.Upload(videoFile, {
  endpoint: 'https://video.3speak.tv/files',
  metadata: {
    video_id: '507f1f77bcf86cd799439011',
    owner: 'username',
    permlink: 'abc123def',
    filename: 'video.mp4',
    filetype: 'video/mp4'
  },
  onProgress: (bytesUploaded, bytesTotal) => {
    const percentage = (bytesUploaded / bytesTotal * 100).toFixed(2);
    console.log(`Upload progress: ${percentage}%`);
  },
  onSuccess: () => {
    console.log('Upload completed');
    // Start polling for encoding status
  }
});

upload.start();
```

#### 4. Poll Encoding Status

```javascript
GET https://video.3speak.tv/api/upload/video/:video_id/status

Headers:
  Authorization: Bearer YOUR_SECRET_TOKEN

Response:
{
  "success": true,
  "data": {
    "video": {
      "_id": "507f1f77bcf86cd799439011",
      "owner": "username",
      "permlink": "abc123def",
      "status": "encoding_ipfs",  // or "published"
      "filename": "ipfs://QmXXX...",
      "thumbnail": "ipfs://QmYYY...",
      "encodingProgress": 45
    },
    "job": {
      "id": "uuid-here",
      "status": "running",  // queued, running, completed, failed
      "progress": {
        "pct": 45,
        "download_pct": 100
      }
    }
  }
}
```

### Status Flow

```
uploaded → encoding_ipfs → published
```

- **uploaded**: Video uploaded to IPFS, job created
- **encoding_ipfs**: Encoder processing video
- **published**: Video published to Hive blockchain

---

## 🎬 Demo Reference Implementation

The included demo (`/demo.html`) shows the complete workflow:

```javascript
// See: public/js/demo-app.js for full implementation

1. User logs in with Hive Keychain
2. Select video file (auto-detects duration)
3. Optional: Upload thumbnail
4. Click "Start Upload"
5. Real-time progress:
   - Preparing... (0%)
   - Uploading thumbnail... (5%)
   - Uploading video... (10-70%)
   - Processing IPFS... (70-80%)
   - Encoding... (80-100%)
   - Published! ✅
```

**Use this as your reference** for integrating into 3speak.tv main upload page.

---

## 🔍 Monitoring & Logs

### Log Files

```bash
# Application logs
tail -f /var/www/3speak-upload/logs/combined.log
tail -f /var/www/3speak-upload/logs/error.log

# Systemd logs
sudo journalctl -u 3speak-upload -f
sudo journalctl -u tusd -f
```

### Health Check

```bash
curl https://video.3speak.tv/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-11-13T00:00:00.000Z",
  "uptime": 3600,
  "database": {
    "threespeak": "connected",
    "encoder": "connected"
  }
}
```

### Common Issues

**Problem:** Jobs not created  
**Solution:** Check TUS hook permissions: `chmod +x /tmp/tus-hooks/post-finish`

**Problem:** IPFS upload fails  
**Solution:** Verify supernode connection: `curl http://65.21.201.94:5002/api/v0/version`

**Problem:** Duplicate jobs  
**Solution:** Already fixed - idempotency protection built-in

**Problem:** Database connection errors  
**Solution:** Check MongoDB connection strings in `.env`

---

## 🔐 Security Checklist

- ✅ Change `UPLOAD_SECRET_TOKEN` to strong random value
- ✅ Restrict MongoDB access to production IPs only
- ✅ Use HTTPS (SSL certificates already on video.3speak.tv)
- ✅ Keep `.env` file secured (`chmod 600 .env`)
- ✅ Rate limiting active (built-in)
- ✅ Input validation on all endpoints
- ✅ CORS configured for `video.3speak.tv` only

---

## 🎯 Migration Path

### Phase 1: Deploy Alongside Legacy (Recommended)

1. Deploy this service to `video.3speak.tv`
2. Test demo at `https://video.3speak.tv/demo.html`
3. Verify videos upload and publish correctly
4. Monitor encoding jobs in dashboard

### Phase 2: Add to Main Upload Page

1. Fork existing upload page
2. Replace API calls with new endpoints (see API Integration above)
3. Test internally with beta users
4. Gradual rollout

### Phase 3: Sunset Legacy Gateway

1. Monitor success rate (should be 99%+)
2. Switch all users to new service
3. Deprecate old gateway

---

## 📞 Support

**Built by:** [@meno](https://peakd.com/@meno)  
**Purpose:** Demonstrate that upload experience doesn't have to be complicated

**For questions:**
- Check `/docs` folder for detailed specs
- Review demo source code (`public/js/demo-app.js`)
- Test locally first: `npm run dev`

---

## ✅ Quick Validation

After deployment, verify:

```bash
# 1. Service running
curl https://video.3speak.tv/health

# 2. Demo accessible
# Open: https://video.3speak.tv/demo.html

# 3. Upload a test video via demo
# Should see: uploaded → encoding_ipfs → published

# 4. Check MongoDB for new video entry
mongo threespeak --eval "db.videos.findOne({owner: 'testuser'})"

# 5. Check encoder jobs
mongo spk-encoder-gateway --eval "db.jobs.findOne({status: 'queued'})"
```

All working? **You're live!** 🚀

---

**This is production-ready.** No additional development needed. Just deploy and integrate into your frontend.
