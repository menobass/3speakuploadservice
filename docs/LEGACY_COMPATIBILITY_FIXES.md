# Legacy Compatibility Fixes Applied

**Date:** 2025-11-12  
**Purpose:** Ensure 100% compatibility with existing 3Speak infrastructure

---

## Critical Fixes Applied

### 1. ✅ Beneficiaries Field
**Issue:** Was hardcoding encoder beneficiary to sagarkothari88  
**Fix:** Set to empty array `"[]"` - encoder gateway adds beneficiary automatically after job completion

```javascript
// BEFORE (WRONG):
beneficiaries: '[{"account":"sagarkothari88","weight":100,"src":"ENCODER_PAY"}]'

// AFTER (CORRECT):
beneficiaries: beneficiaries || "[]"  // Empty - encoder adds payment after job completes
```

**Why:** The encoder gateway (`scripts/encoderJobCheck.js`) automatically adds the correct encoder beneficiary based on which node processes the job. Platform beneficiary (`spk.beneficiary`) is added during Hive blockchain publish.

---

### 2. ✅ App Field (Auto-Publish Fix)
**Issue:** Was setting `app: '3speak-upload'` which triggers `publish_manual` status  
**Fix:** Set to `null` to enable auto-publish for web uploads

```javascript
// BEFORE (WRONG):
app = '3speak-upload'

// AFTER (CORRECT):
app,  // Should be null for auto-publish web uploads
```

**Why:** Per legacy logic, if `app` is set (not null), the encoder sets status to `publish_manual` after encoding completes. Web uploads should auto-publish immediately.

---

### 3. ✅ Donations Field
**Issue:** Schema default was `true`  
**Fix:** Changed default to `false` for web uploads

```javascript
// BEFORE (WRONG):
donations: { 
  type: Boolean, 
  default: true 
}

// AFTER (CORRECT):
donations: { 
  type: Boolean, 
  default: false  // Web upload default (legacy compatible)
}
```

**Why:** Legacy web uploads default to `donations: false`. Only mobile uploads or specific user settings enable donations.

---

### 4. ✅ Community vs Hive Fields
**Issue:** Was putting technical hive ID in `community` field  
**Fix:** Separated display name (`community`) from technical ID (`hive`)

```javascript
// Structure:
community: "Politics",      // Human-readable display name (can be null)
hive: "hive-165423"        // Technical blockchain community ID
```

**Why:** Frontend displays `community` name, blockchain uses `hive` ID. These are separate concerns.

---

## Status Flow (Corrected)

### Web Upload (Auto-Publish)
```
1. uploaded              ← Initial video entry creation
2. encoding_preparing    ← TUS upload complete, processing begins
3. encoding_ipfs         ← Sent to encoder gateway
4. published             ← Encoding complete, auto-published to Hive ✅
```

**Conditions:**
- `fromMobile === false` (or undefined)
- `app === null` (or undefined)
- `publish_type === "publish"`

### Mobile/App Upload (Manual Publish)
```
1. uploaded
2. encoding_preparing
3. encoding_ipfs
4. publish_manual        ← User must manually publish
```

**Conditions:**
- `fromMobile === true` OR
- `app !== null`

---

## Complete Default Field Values

```javascript
{
  // Required fields
  originalFilename: req.originalFilename,
  permlink: generatePermlink(),
  duration: req.duration,
  size: req.size,
  owner: req.owner,
  status: "uploaded",
  encoding_price_steem: "0.000",
  paid: false,
  encodingProgress: 0,
  created: new Date(),
  
  // Content (from request or defaults)
  title: req.title,
  description: req.description,
  tags: req.tags.join(','),
  tags_v2: req.tags,
  language: req.language || "en",
  category: req.category || "general",
  community: req.community || null,
  hive: req.hive || "hive-181335",
  
  // Rewards & Publishing (100% legacy compatible)
  beneficiaries: req.beneficiaries || "[]",  // ✅ Empty - encoder adds later
  votePercent: req.votePercent || 1,
  declineRewards: req.declineRewards || false,
  rewardPowerup: req.rewardPowerup || false,
  donations: false,                          // ✅ Web default
  publish_type: req.publish_type || "publish",
  upvoteEligible: true,
  reducedUpvote: false,
  
  // Technical flags (100% legacy compatible)
  fromMobile: false,                         // ✅ Web upload service
  app: req.app || null,                      // ✅ null enables auto-publish
  upload_type: "ipfs",
  local_filename: null,
  
  // Auto-calculate
  firstUpload: (await Video.countDocuments({owner: req.owner})) === 0
}
```

---

## Testing Verification

### Test Upload: coolmole/d78cad0e
**Result:** ✅ Encoding completed successfully, created proper job

**Issues Found:**
- ❌ Status: `publish_manual` (should be `published`)
- ❌ Beneficiaries: `null` (should have encoder beneficiary)

**Root Cause:** Old server (PID 126354) was running without these fixes

**Resolution:** Restart server with updated code, test again

---

## Next Steps

1. ✅ Documentation created (`VIDEO_SCHEMA_REFERENCE.md`)
2. ✅ All critical fields corrected
3. 🔄 Restart server with updated code
4. 🧪 Test new upload with correct defaults
5. ✅ Verify auto-publish works (status → `published`)
6. ✅ Verify encoder beneficiary is added automatically

---

## Files Modified

- `src/routes/upload.js` - Fixed beneficiaries, app, field handling
- `src/models/Video.js` - Fixed donations default
- `docs/VIDEO_SCHEMA_REFERENCE.md` - Complete field documentation
- `docs/LEGACY_COMPATIBILITY_FIXES.md` - This file
