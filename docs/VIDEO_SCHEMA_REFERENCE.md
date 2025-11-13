# 3Speak Video Schema Field Reference

**Complete documentation of video entry creation logic, field defaults, validation rules, and status progression.**

---

## 1. Beneficiaries Logic

### Default Beneficiary Structure

The system **reserves 1100 weight (11%)** for platform beneficiaries by default. This is hardcoded in the validation logic:

```javascript
// From routes/index.js line 650
let totalWeight = 1100;
```

### Beneficiary Sources (`src` field values)

The `src` field tracks why a beneficiary was added:

- **`ENCODER_PAY`** - Payment to the encoder node that processed the video (1% = 100 weight)
- **`ENCODER_PAY_AND_MOBILE_APP_PAY`** - Combined payment when encoder is sagarkothari88 AND upload is from mobile (1% = 100 weight)
- **`MOBILE_APP_PAY`** - Payment to mobile app developer sagarkothari88 (1% = 100 weight)
- **User-added beneficiaries** - No `src` field (user-defined beneficiaries from account metadata or UI)

### Web Upload Beneficiaries

**Initial State:**
```json
beneficiaries: "[]"
```

**After Encoding (set by `scripts/encoderJobCheck.js`):**

```json
[
  {
    "account": "spk.beneficiary",
    "weight": 1100,
    "src": "PLATFORM_FEE"  // Implied, added during Hive publish
  },
  {
    "account": "<encoder_hive_account>",
    "weight": 100,
    "src": "ENCODER_PAY"
  }
]
```

**Total:** 12% (11% platform + 1% encoder)

### Mobile Upload Beneficiaries

**Scenario 1: Encoder is `sagarkothari88`**

```json
[
  {
    "account": "spk.beneficiary",
    "weight": 900,
    "src": "PLATFORM_FEE"
  },
  {
    "account": "sagarkothari88",
    "weight": 100,
    "src": "ENCODER_PAY_AND_MOBILE_APP_PAY"
  }
]
```

**Scenario 2: Encoder is NOT `sagarkothari88`**

```json
[
  {
    "account": "spk.beneficiary",
    "weight": 900,
    "src": "PLATFORM_FEE"
  },
  {
    "account": "<encoder_hive_account>",
    "weight": 100,
    "src": "ENCODER_PAY"
  },
  {
    "account": "sagarkothari88",
    "weight": 100,
    "src": "MOBILE_APP_PAY"
  }
]
```

**Total:** 11% (9% platform + 1% encoder + 1% mobile dev)

### Key Insight for Simplified Upload Service

**✅ CRITICAL:** Initial beneficiaries should be `"[]"` (empty array as string).

The encoder gateway automatically adds the encoder payment beneficiary when the job completes. The platform beneficiary (spk.beneficiary) is added during the Hive blockchain publish step.

---

## 2. Initial Video Status

### Status on Creation

**Initial status when video entry is first created:**

```javascript
status: "uploaded"
```

### Status Progression (Web Upload)

```
1. uploaded              ← Initial creation
2. encoding_preparing    ← After TUS upload completes, script spawned
3. encoding_ipfs         ← Upload sent to encoder gateway
4. published             ← Encoding complete, auto-published to Hive
   OR
4. scheduled             ← Encoding complete, scheduled for future publish
```

### Status Progression (Mobile/App Upload)

```
1. uploaded              ← Initial creation
2. encoding_preparing    ← After upload, processing begins
3. encoding_ipfs         ← Sent to encoder
4. publish_manual        ← Encoding complete, awaits manual publish by user
```

**IMPORTANT:** If `fromMobile === true` OR `app` is set, status becomes `"publish_manual"` after encoding.

---

## 3. Required vs Optional Fields

### REQUIRED Fields (Cannot be null/undefined)

```javascript
{
  originalFilename: String,   // REQUIRED - original file name
  permlink: String,           // REQUIRED - unique identifier (8 chars)
  duration: Number,           // REQUIRED - video length in seconds
  size: Number,               // REQUIRED - file size in bytes
  owner: String,              // REQUIRED - username/user_id
  created: Date,              // REQUIRED - defaults to Date.now()
  status: String,             // REQUIRED - defaults to "uploaded"
  encoding_price_steem: String, // REQUIRED - defaults to "0.000"
  paid: Boolean,              // REQUIRED - defaults to false
  encodingProgress: Number,   // REQUIRED - defaults to 0
}
```

### OPTIONAL Fields with Defaults

```javascript
{
  // Publishing Behavior
  publish_type: "publish",      // "publish" | "schedule"
  
  // Content Settings
  language: "en",                // Language code
  category: "general",           // Content category
  community: null,               // Community name (can be null)
  hive: "hive-181335",          // Hive community ID (defaults to 3Speak)
  
  // Rewards & Beneficiaries
  beneficiaries: "[]",           // JSON string of beneficiary array (EMPTY initially)
  votePercent: 1,                // Upvote percentage (0.0 - 1.0)
  declineRewards: false,         // Decline post rewards
  rewardPowerup: false,          // Power up rewards (100% HP)
  donations: false,              // Enable donations (default false for web)
  upvoteEligible: true,          // Eligible for auto-upvote
  reducedUpvote: false,          // Reduced upvote weight
  
  // Flags & Metadata
  firstUpload: false,            // Is this user's first video (auto-detect)
  fromMobile: false,             // Uploaded via mobile app
  app: null,                     // App identifier (e.g., "3speak/0.3.0")
  
  // Technical
  upload_type: "ipfs",           // "ipfs" | "s3"
  local_filename: null,          // Server-side filename
}
```

---

## 4. Publish Behavior

### Auto-Publish (Web Uploads)

Videos automatically publish to Hive blockchain when:

1. **Encoding completes successfully**
2. **AND** `publish_type === "publish"`
3. **AND** `fromMobile !== true`
4. **AND** `app` is `null` or `undefined`

### Manual Publish Required

Status is set to `"publish_manual"` when:

1. **Mobile app upload** (`fromMobile === true`)
2. **OR third-party app upload** (`app` field is set)

---

## 5. Field Values and Validation

### Language
**Default:** `"en"` (auto-detected from description/title if possible)

### Category
**Default:** `"general"`

### App (Application Identifier)
**Default:** `null` for web uploads

**Simplified Upload Service should use:** `null` (to enable auto-publish)

### Vote Percent
**Default:** `1` (100%)

### Decline Rewards
**Default:** `false`

### Reward Powerup
**Default:** `false`

### Community & Hive
**Defaults:** 
- `community: null` 
- `hive: "hive-181335"` (3Speak official community)

### Donations
**Default:** `false` for web uploads

---

## Recommended Defaults for Simplified Upload Service

```javascript
{
  // Required fields (from upload request)
  originalFilename: req.originalFilename,
  permlink: generatePermlink(),  // 8 random chars
  duration: req.duration,
  size: req.size,
  owner: req.owner,
  
  // Auto-set required fields
  status: "uploaded",
  encoding_price_steem: "0.000",
  paid: false,
  encodingProgress: 0,
  created: new Date(),
  
  // Content fields (from request or defaults)
  title: req.title,
  description: req.description,
  tags: req.tags.join(','),
  tags_v2: req.tags,
  language: req.language || "en",
  category: req.category || "general",
  community: req.community || null,
  hive: req.hive || "hive-181335",
  
  // Rewards & Publishing
  beneficiaries: "[]",           // EMPTY - encoder adds payment later
  votePercent: req.votePercent || 1,
  declineRewards: req.declineRewards || false,
  rewardPowerup: req.rewardPowerup || false,
  donations: false,              // Web default
  publish_type: req.publish_type || "publish",
  upvoteEligible: true,
  reducedUpvote: false,
  
  // Technical flags
  fromMobile: false,             // Web upload service
  app: null,                     // Enable auto-publish
  upload_type: "ipfs",
  local_filename: null,
  
  // Auto-calculate
  firstUpload: (await Video.countDocuments({owner: req.owner})) === 0
}
```
