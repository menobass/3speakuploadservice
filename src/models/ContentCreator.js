const mongoose = require('mongoose');
const { threeSpeakDb } = require('../config/database');

// ============================================
// CONTENT CREATOR SCHEMA
// ============================================
const contentCreatorSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  banned: {
    type: Boolean,
    default: false
  },
  livestreamEnabled: {
    type: Boolean,
    default: false
  },
  canUpload: {
    type: Boolean,
    default: true
  },
  canProxyUpvote: {
    type: Boolean,
    default: false
  },
  isCitizenJournalist: {
    type: Boolean,
    default: false
  },
  limit: {
    type: Number,
    default: 0
  },
  hidden: {
    type: Boolean,
    default: false
  },
  joined: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    default: 0
  },
  postWarning: {
    type: Boolean,
    default: false
  },
  askWitnessVote: {
    type: Boolean,
    default: true
  },
  badges: {
    type: [String],
    default: []
  },
  lastPayment: {
    type: Date,
    default: null
  },
  warningPending: {
    type: Boolean,
    default: false
  },
  upvoteEligible: {
    type: Boolean,
    default: true
  },
  awaitingVerification: {
    type: Boolean,
    default: false
  },
  verificationEvidence: {
    type: String,
    default: null
  },
  verified: {
    type: Boolean,
    default: true
  },
  verificationRequired: {
    type: Boolean,
    default: false
  },
  autoFillTitle: {
    type: Boolean,
    default: false
  },
  reducedUpvote: {
    type: Boolean,
    default: false
  },
  ipfsBeta: {
    type: Boolean,
    default: true
  },
  __v: {
    type: Number,
    default: 0
  }
}, {
  collection: 'contentcreators',
  timestamps: false
});

// ============================================
// INDEXES
// ============================================
contentCreatorSchema.index({ username: 1 });
contentCreatorSchema.index({ banned: 1 });
contentCreatorSchema.index({ canUpload: 1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find or create content creator
 * Returns { creator, isNew }
 */
contentCreatorSchema.statics.findOrCreate = async function(username) {
  let creator = await this.findOne({ username });
  let isNew = false;

  if (!creator) {
    creator = new this({
      username,
      joined: new Date()
    });
    await creator.save();
    isNew = true;
    console.log(`✅ Created new content creator: ${username}`);
  }

  return { creator, isNew };
};

/**
 * Check if user can upload
 * Returns { canUpload: boolean, reason: string }
 */
contentCreatorSchema.statics.checkUploadPermission = async function(username) {
  const { creator } = await this.findOrCreate(username);

  if (creator.banned) {
    return {
      canUpload: false,
      reason: 'User is banned from uploading'
    };
  }

  if (!creator.canUpload) {
    return {
      canUpload: false,
      reason: 'User does not have upload permission'
    };
  }

  return {
    canUpload: true,
    reason: null
  };
};

// ============================================
// MODEL CREATION
// ============================================
const createModel = () => {
  const { threeSpeakDb } = require('../config/database');
  if (!threeSpeakDb) {
    throw new Error('ThreeSpeak database connection not established');
  }
  return threeSpeakDb.model('ContentCreator', contentCreatorSchema);
};

module.exports = createModel;
