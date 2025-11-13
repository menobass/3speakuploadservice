const { v4: uuidv4 } = require('uuid');

class JobService {
  constructor() {
    // Lazy load models to avoid circular dependencies
    this._Job = null;
  }

  get Job() {
    if (!this._Job) {
      this._Job = require('../models/Job')();
    }
    return this._Job;
  }

  /**
   * Create encoding job for uploaded video
   * @param {Object} video - Video document
   * @param {string} ipfsCid - IPFS hash of uploaded file
   * @param {number} fileSize - File size in bytes
   * @param {string} gatewayUrl - Gateway URL for encoder access
   * @returns {Promise<string>} Job ID
   */
  async createEncodingJob(video, ipfsCid, fileSize, gatewayUrl) {
    const jobId = uuidv4();
    
    try {
      const job = new this.Job({
        id: jobId,
        status: 'queued',
        metadata: {
          video_owner: video.owner,
          video_permlink: video.permlink
        },
        storageMetadata: {
          app: '3speak',
          key: `${video.owner}/${video.permlink}/video`,
          type: 'video'
        },
        input: {
          uri: gatewayUrl,
          size: fileSize
        },
        // Initialize progress structure that encoder nodes expect
        progress: {
          download_pct: 0,
          pct: 0
        }
      });
      
      await job.save();
      
      console.log(`📋 Created encoding job: ${jobId} for ${video.owner}/${video.permlink}`);
      console.log(`📡 Input URI: ${gatewayUrl}`);
      
      return jobId;
    } catch (error) {
      console.error(`❌ Failed to create job ${jobId}:`, error);
      throw new Error(`Job creation failed: ${error.message}`);
    }
  }

  /**
   * Find job by video details
   * @param {string} owner - Video owner
   * @param {string} permlink - Video permlink
   * @returns {Promise<Object|null>} Job document
   */
  async findJobByVideo(owner, permlink) {
    try {
      return await this.Job.findByVideo(owner, permlink);
    } catch (error) {
      console.error(`Failed to find job for ${owner}/${permlink}:`, error);
      return null;
    }
  }

  /**
   * Update job status and progress
   * @param {string} jobId - Job ID
   * @param {string} status - New status
   * @param {Object} progressData - Progress information
   * @returns {Promise<Object|null>} Updated job
   */
  async updateJobStatus(jobId, status, progressData = null) {
    try {
      const job = await this.Job.findOne({ id: jobId });
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      return await job.updateStatus(status, progressData);
    } catch (error) {
      console.error(`Failed to update job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get queued jobs (for monitoring)
   * @param {number} limit - Max number of jobs to return
   * @returns {Promise<Array>} Queued jobs
   */
  async getQueuedJobs(limit = 50) {
    try {
      return await this.Job.findQueued(limit);
    } catch (error) {
      console.error('Failed to get queued jobs:', error);
      return [];
    }
  }

  /**
   * Get job statistics
   * @returns {Promise<Object>} Job stats by status
   */
  async getJobStats() {
    try {
      const stats = await this.Job.getStats();
      
      // Transform aggregation result into more readable format
      const result = {
        total: 0,
        byStatus: {},
        avgDurationMs: 0
      };
      
      let totalDuration = 0;
      let completedJobs = 0;
      
      stats.forEach(stat => {
        result.byStatus[stat._id] = {
          count: stat.count,
          avgDurationMs: stat.avgDuration || 0
        };
        result.total += stat.count;
        
        if (stat.avgDuration && ['completed', 'failed'].includes(stat._id)) {
          totalDuration += stat.avgDuration * stat.count;
          completedJobs += stat.count;
        }
      });
      
      if (completedJobs > 0) {
        result.avgDurationMs = Math.round(totalDuration / completedJobs);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to get job stats:', error);
      return { total: 0, byStatus: {}, avgDurationMs: 0 };
    }
  }

  /**
   * Find stale jobs (running but not updated recently)
   * @param {number} staleMinutes - Minutes after which job is considered stale
   * @returns {Promise<Array>} Stale jobs
   */
  async findStaleJobs(staleMinutes = 30) {
    try {
      return await this.Job.findStale(staleMinutes);
    } catch (error) {
      console.error('Failed to find stale jobs:', error);
      return [];
    }
  }

  /**
   * Retry failed job
   * @param {string} jobId - Job ID to retry
   * @returns {Promise<Object|null>} Updated job or null if can't retry
   */
  async retryJob(jobId) {
    try {
      const job = await this.Job.findOne({ id: jobId });
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      if (job.status !== 'failed') {
        throw new Error(`Job ${jobId} is not in failed status`);
      }
      
      if (!job.canRetry()) {
        throw new Error(`Job ${jobId} has exceeded maximum retries`);
      }
      
      // Reset job for retry
      job.status = 'queued';
      job.assigned_to = null;
      job.assigned_date = null;
      job.start_date = null;
      job.completed_at = null;
      job.error_message = null;
      job.progress = null;
      job.last_pinged = null;
      
      await job.save();
      
      console.log(`🔄 Retrying job: ${jobId} (attempt ${job.retry_count + 1})`);
      return job;
    } catch (error) {
      console.error(`Failed to retry job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel job
   * @param {string} jobId - Job ID to cancel
   * @returns {Promise<Object|null>} Updated job
   */
  async cancelJob(jobId) {
    try {
      const job = await this.Job.findOne({ id: jobId });
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      if (job.isComplete) {
        throw new Error(`Job ${jobId} is already complete`);
      }
      
      return await job.updateStatus('cancelled');
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get jobs by encoder DID
   * @param {string} encoderDid - Encoder DID
   * @param {Array} statuses - Job statuses to filter by
   * @returns {Promise<Array>} Jobs assigned to encoder
   */
  async getJobsByEncoder(encoderDid, statuses = ['running']) {
    try {
      return await this.Job.findByEncoder(encoderDid, statuses);
    } catch (error) {
      console.error(`Failed to get jobs for encoder ${encoderDid}:`, error);
      return [];
    }
  }

  /**
   * Health check - verify job creation and database connectivity
   * @returns {Promise<{healthy: boolean, error?: string, stats?: Object}>}
   */
  async healthCheck() {
    try {
      // Test basic database connectivity
      await this.Job.findOne({}).limit(1);
      
      // Get current stats
      const stats = await this.getJobStats();
      
      return {
        healthy: true,
        stats: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new JobService();