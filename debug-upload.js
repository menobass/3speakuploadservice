#!/usr/bin/env node

// Debug script to manually trigger IPFS upload for stuck video
const path = require('path');
const fs = require('fs');

// Load environment
require('dotenv').config();

// Import services
const IPFSService = require('./src/services/ipfs');
const { getVideoModel } = require('./src/models/Video');

async function debugUpload(videoId) {
  try {
    console.log(`🔍 Debug upload for video: ${videoId}`);
    
    // Connect to database
    const { connectDatabases } = require('./src/config/database');
    await connectDatabases();
    
    // Find video document
    const createVideoModel = require('./src/models/Video');
    const Video = createVideoModel();
    const video = await Video.findById(videoId);
    
    if (!video) {
      console.error(`❌ Video not found: ${videoId}`);
      process.exit(1);
    }
    
    console.log(`📋 Video found:`, {
      id: video._id,
      owner: video.owner,
      permlink: video.permlink,
      status: video.status,
      filename: video.filename,
      job_id: video.job_id,
      local_filename: video.local_filename,
      size: video.size
    });
    
    // Check if already processed
    if (video.filename && video.filename.startsWith('ipfs://')) {
      console.log(`⚠️ Video already has IPFS hash: ${video.filename}`);
      return;
    }
    
    // Find TUS upload file
    const tusFiles = fs.readdirSync('/tmp/uploads')
      .filter(f => !f.endsWith('.info'))
      .map(f => {
        const infoFile = `/tmp/uploads/${f}.info`;
        if (fs.existsSync(infoFile)) {
          const info = fs.readFileSync(infoFile, 'utf8');
          const videoMatch = info.match(/"video_id":"([^"]+)"/);
          if (videoMatch && videoMatch[1] === videoId) {
            return `/tmp/uploads/${f}`;
          }
        }
        return null;
      })
      .filter(Boolean);
    
    if (tusFiles.length === 0) {
      console.error(`❌ No TUS upload file found for video ${videoId}`);
      console.log(`📁 Available TUS files:`, fs.readdirSync('/tmp/uploads').slice(0, 5));
      return;
    }
    
    const filePath = tusFiles[0];
    console.log(`📁 Found TUS file: ${filePath}`);
    console.log(`📊 File size: ${fs.statSync(filePath).size} bytes`);
    
    // Test IPFS upload
    console.log(`⬆️ Starting IPFS upload...`);
    const ipfsService = require('./src/services/ipfs');
    
    const uploadResult = await ipfsService.uploadFile(filePath);
    
    console.log(`✅ Upload successful:`, uploadResult);
    
    // Update video document
    video.filename = `ipfs://${uploadResult.hash}`;
    video.status = 'encoding_ipfs';
    video.fallback_mode = uploadResult.fallbackMode;
    video.local_filename = null;
    
    await video.save();
    
    console.log(`💾 Video document updated with IPFS hash`);
    
  } catch (error) {
    console.error(`❌ Debug upload failed:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Get video ID from command line
const videoId = process.argv[2];
if (!videoId) {
  console.error('Usage: node debug-upload.js <video_id>');
  console.error('Example: node debug-upload.js 69168ec4e3818e485ee35b8b');
  process.exit(1);
}

debugUpload(videoId).then(() => {
  console.log('✅ Debug upload completed');
  process.exit(0);
});