# 3Speak Simplified Upload Service

## Project Overview
A minimal upload service for 3Speak that bypasses the legacy gateway by directly injecting video entries and encoding jobs into MongoDB. Uses token authentication, TUS resumable uploads, and integrates with existing 3Speak infrastructure.

## Architecture
- **Backend**: Node.js with Express.js
- **Database**: MongoDB (dual connections - threespeak + encoder)  
- **File Upload**: TUS resumable uploads
- **Storage**: IPFS (supernode + fallback strategy)
- **Authentication**: Bearer token
- **Job Queue**: Direct MongoDB job creation for existing encoders

## Key Features
- Single token authentication
- TUS integration with resumable uploads
- Direct MongoDB injection for videos and jobs
- IPFS supercluster integration (65.21.201.94:5002)
- Zero local storage (immediate cleanup)
- Fallback IPFS strategy
- Automated cleanup service
- Production-ready security and monitoring

## Development Guidelines
- Follow the existing 3Speak video and job schemas exactly
- Implement proper error handling and circuit breakers
- Use structured logging with Winston
- Include comprehensive input validation
- Implement rate limiting and security measures
- Maintain compatibility with existing encoder system

## Setup Instructions

1. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connections, IPFS settings, etc.
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Production Deployment**
   ```bash
   npm start
   # or use PM2: pm2 start src/app.js --name 3speak-upload
   ```

## Required Configuration
- MongoDB connection strings (3Speak + Encoder databases)
- UPLOAD_SECRET_TOKEN for authentication
- TUS server endpoint
- IPFS supernode access (65.21.201.94:5002)
- Optional: Local IPFS fallback configuration

## Quick Test
```bash
curl http://localhost:8080/health
```