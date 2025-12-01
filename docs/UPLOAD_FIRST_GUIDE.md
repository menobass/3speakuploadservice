# Upload-First Flow Guide

## Overview

The **Upload-First Flow** improves UX by starting the video upload immediately when a file is selected, before the user fills out metadata. This provides a much better experience, especially for large files.

### Traditional vs Upload-First

| Traditional Flow | Upload-First Flow |
|-----------------|-------------------|
| 1. Fill form first | 1. Select video file |
| 2. Click "Submit" | 2. **Upload starts automatically** |
| 3. Upload video | 3. Fill form while uploading |
| 4. Wait for upload | 4. Click submit (enabled when upload done) |
| 5. Processing starts | 5. Processing starts immediately |

**Result:** User experiences faster workflow with no waiting after submission.

---

## How It Works

### Step 1: Initialize Upload

When user selects a file, call `/api/upload/init`:

```javascript
const response = await fetch('https://video.3speak.tv/api/upload/init', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    owner: 'alice',
    originalFilename: 'my-video.mp4',
    size: 50000000,  // bytes
    duration: 120.5  // seconds
  })
});

const { data } = await response.json();
// data = { upload_id, tus_endpoint, expires_in: 3600 }
```

**Returns:**
- `upload_id` - Unique identifier for this upload
- `tus_endpoint` - URL for TUS upload
- `expires_in` - Upload expires in 1 hour if not finalized

### Step 2: Upload Video with TUS

Start TUS upload immediately with `upload_id` in metadata:

```javascript
const upload = new tus.Upload(file, {
  endpoint: data.tus_endpoint,
  metadata: {
    upload_id: data.upload_id,  // Required for upload-first
    filename: file.name
  },
  onProgress: (bytesUploaded, bytesTotal) => {
    const percentage = (bytesUploaded / bytesTotal) * 100;
    updateProgressBar(percentage);
  },
  onSuccess: () => {
    console.log('Upload complete!');
    enableSubmitButton();  // User can now submit the form
  }
});

upload.start();
```

**User Experience:** Progress bar shows upload happening while user fills out title, description, tags, etc.

### Step 3: Finalize Upload

When user clicks submit (after upload completes), call `/api/upload/finalize`:

```javascript
const formData = new FormData();
formData.append('upload_id', uploadId);
formData.append('title', 'My Awesome Video');
formData.append('description', 'This is my video description...');
formData.append('tags[]', 'travel');
formData.append('tags[]', 'vlog');
formData.append('community', 'hive-181335');
formData.append('thumbnail', thumbnailFile);  // optional
formData.append('declineRewards', 'false');

const response = await fetch('https://video.3speak.tv/api/upload/finalize', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const { data } = await response.json();
// data = { video_id, permlink, job_id }
```

**Backend Processing:**
1. Creates video entry in database
2. Uploads file to IPFS supercluster
3. Creates encoding job
4. Returns immediately

### Step 4: Poll Status

Same as traditional flow - poll `/api/upload/video/:id/status` for encoding progress.

---

## Complete Example

```javascript
class UploadFirstFlow {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseUrl = 'https://video.3speak.tv';
    this.uploadId = null;
    this.tusUpload = null;
  }

  /**
   * Called when user selects video file
   */
  async onFileSelected(file) {
    try {
      // Get video duration
      const duration = await this.getVideoDuration(file);
      
      // Initialize upload
      const response = await fetch(`${this.baseUrl}/api/upload/init`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner: this.currentUser,
          originalFilename: file.name,
          size: file.size,
          duration
        })
      });
      
      const { data } = await response.json();
      this.uploadId = data.upload_id;
      
      // Start TUS upload immediately
      this.startTusUpload(file, data.tus_endpoint);
      
    } catch (error) {
      console.error('File selection error:', error);
      this.showError(error.message);
    }
  }

  /**
   * Start TUS upload
   */
  startTusUpload(file, endpoint) {
    this.tusUpload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        upload_id: this.uploadId,
        filename: file.name,
        filetype: file.type
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
        this.updateUploadProgress(pct);
      },
      onSuccess: () => {
        console.log('Upload complete!');
        this.onUploadComplete();
      },
      onError: (error) => {
        console.error('Upload error:', error);
        this.showError('Upload failed: ' + error);
      }
    });

    this.tusUpload.start();
  }

  /**
   * Called when upload completes
   */
  onUploadComplete() {
    // Enable submit button
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('submit-btn').textContent = '✅ Finalize Upload';
    
    // Show success message
    this.showSuccess('Upload complete! Fill out the form and submit.');
  }

  /**
   * Called when user submits form
   */
  async onFormSubmit(formData) {
    try {
      // Disable submit during processing
      document.getElementById('submit-btn').disabled = true;
      
      // Add upload_id to form
      formData.append('upload_id', this.uploadId);
      
      // Finalize upload
      const response = await fetch(`${this.baseUrl}/api/upload/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: formData
      });
      
      const { data } = await response.json();
      
      console.log('Video created:', data.video_id);
      
      // Start polling for encoding status
      this.pollEncodingStatus(data.video_id);
      
    } catch (error) {
      console.error('Finalize error:', error);
      this.showError(error.message);
      document.getElementById('submit-btn').disabled = false;
    }
  }

  /**
   * Get video duration using HTML5 video element
   */
  async getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        reject(new Error('Failed to read video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Poll encoding status
   */
  async pollEncodingStatus(videoId) {
    const maxAttempts = 60;
    let attempts = 0;
    
    const poll = async () => {
      attempts++;
      
      try {
        const response = await fetch(
          `${this.baseUrl}/api/upload/video/${videoId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            }
          }
        );
        
        const { data } = await response.json();
        
        this.updateStatus(data.status);
        
        // Check if done
        if (data.status === 'published' || data.status === 'encoding_ready') {
          this.onEncodingComplete(data);
          return;
        }
        
        if (data.status === 'encoding_failed') {
          this.showError('Encoding failed');
          return;
        }
        
        // Continue polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);  // Poll every 5 seconds
        }
        
      } catch (error) {
        console.error('Status poll error:', error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };
    
    poll();
  }

  // UI helper methods
  updateUploadProgress(percentage) {
    document.getElementById('upload-progress').style.width = percentage + '%';
    document.getElementById('upload-text').textContent = `Uploading ${percentage}%`;
  }

  updateStatus(status) {
    const statusMap = {
      'encoding_queued': 'Queued for encoding...',
      'encoding_ipfs': 'Uploading to IPFS...',
      'encoding_preparing': 'Preparing encoding...',
      'encoding_progress': 'Encoding in progress...',
      'encoding_ready': 'Encoding complete!',
      'published': 'Published to Hive!'
    };
    
    document.getElementById('status-text').textContent = 
      statusMap[status] || status;
  }

  showSuccess(message) {
    // Implement your success UI
  }

  showError(message) {
    // Implement your error UI
  }

  onEncodingComplete(video) {
    // Show completion UI with video info
    console.log('Video ready:', video);
  }
}
```

---

## Safety Features

### Submit Button Disabled Until Upload Completes

**Critical:** The submit button MUST be disabled until the TUS upload finishes:

```javascript
// Initial state
const submitBtn = document.getElementById('submit-btn');
submitBtn.disabled = true;
submitBtn.textContent = '⏳ Waiting for upload...';

// On TUS upload success
tusUpload.onSuccess = () => {
  submitBtn.disabled = false;
  submitBtn.textContent = '✅ Finalize Upload';
};
```

**Why?** Prevents race conditions where user submits before file upload completes.

### Automatic Cleanup

Orphaned uploads (not finalized within 1 hour) are automatically cleaned up by the backend.

### Error Handling

Always handle TUS upload errors:

```javascript
tusUpload.onError = (error) => {
  console.error('Upload failed:', error);
  submitBtn.disabled = true;
  submitBtn.textContent = '❌ Upload Failed - Select File Again';
  
  // Allow user to retry by selecting file again
  document.getElementById('file-input').value = '';
};
```

---

## API Reference

### POST /api/upload/init

**Request:**
```json
{
  "owner": "alice",
  "originalFilename": "my-video.mp4",
  "size": 50000000,
  "duration": 120.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "upload_id": "alice_1733049600000_a1b2c3d4e5f6g7h8",
    "tus_endpoint": "https://video.3speak.tv/files",
    "expires_in": 3600
  }
}
```

### POST /api/upload/finalize

**Request (FormData):**
```
upload_id: alice_1733049600000_a1b2c3d4e5f6g7h8
title: My Awesome Video
description: This is my video...
tags[]: travel
tags[]: vlog
community: hive-181335
thumbnail: [File]
declineRewards: false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "video_id": "674b3f8e9d1a2b3c4d5e6f7g",
    "permlink": "1733049600-my-awesome-video",
    "job_id": "alice/1733049600-my-awesome-video"
  }
}
```

---

## Demo Implementation

See `public/demo.html` and `public/js/demo-app.js` for a complete working example with:
- Tab switcher for Traditional vs Upload-First
- Real-time upload progress
- Submit button state management
- Status polling
- Error handling

---

## Backward Compatibility

The traditional flow (`/prepare` endpoint) remains fully functional. You can:
- Keep using traditional flow in production
- Gradually migrate to upload-first
- Use both methods in parallel
- Let users choose their preferred method

No breaking changes - upload-first is purely additive.

---

## Questions?

Contact [@meno](https://peakd.com/@meno) for support.
