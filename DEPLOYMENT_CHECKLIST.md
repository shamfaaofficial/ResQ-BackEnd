# Deployment Checklist for AWS

## Critical Fixes Included in Latest Code

### 1. **Driver Location Sync Fix** 🔧
**File:** `src/controllers/driver.controller.js` (lines 51-60)

**Problem:** Driver locations were only saved to Redis, not MongoDB, causing nearby drivers query to return 0 results.

**Fix:** Now always saves driver location to MongoDB immediately for geospatial queries.

### 2. **Driver Status Toggle Fix** 🔧
**File:** `src/controllers/driver.controller.js` (lines 122-198)

**Problem:** Driver couldn't go online even when passing location because `isLocationEnabled` wasn't being set.

**Fix:** Now accepts location in status toggle request and updates MongoDB.

### 3. **Error Handling in Nearby Drivers** 🔧
**File:** `src/controllers/booking.controller.js` (lines 33-124)

**Problem:** Redis or MongoDB errors would crash the server (502 errors).

**Fix:** Added try-catch blocks and graceful fallbacks.

### 4. **Database Index Auto-Sync** 🔧
**File:** `src/config/database.js` (lines 11-15)

**Problem:** Geospatial indexes might not exist on fresh deployments.

**Fix:** Auto-syncs indexes on server startup (non-blocking).

### 5. **Redis & Firebase Optional** 🔧
**Files:** `src/config/redis.js`, `src/config/firebase.js`

**Problem:** Server would spam errors or crash if Redis/Firebase not available.

**Fix:** Both are now truly optional - app works without them.

---

## Deployment Steps

### Step 1: Push Code to Git

```bash
cd c:\Users\User\Desktop\resq-backend

# Check what files changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Driver location sync and nearby drivers geospatial queries

- Always sync driver location to MongoDB for geospatial queries
- Accept location in driver status toggle endpoint
- Add error handling to prevent 502 errors
- Make Redis and Firebase optional
- Auto-sync database indexes on startup
- Fix duplicate schema index warnings"

# Push to remote
git push origin main
```

### Step 2: Wait for Auto-Deploy

Your DevOps setup should auto-deploy when you push to `main` branch. Wait 2-5 minutes.

### Step 3: Verify Deployment

Check if new code is deployed:

```bash
# Test health endpoint
curl https://dev.resq-qa.com/health

# Check server logs for version/timestamp
# Ask DevOps for access to logs
```

### Step 4: Test Critical Features

#### A. Test Driver Location Update

```bash
curl -X PUT https://dev.resq-qa.com/api/v1/driver/location \
-H "Content-Type: application/json" \
-H "Authorization: Bearer DRIVER_ACCESS_TOKEN" \
-d '{
  "latitude": 25.2854,
  "longitude": 51.5310,
  "address": "Doha, Qatar"
}'
```

**Expected:** `200 OK` with `"success": true`

#### B. Test Driver Status Toggle

```bash
curl -X PATCH https://dev.resq-qa.com/api/v1/driver/status \
-H "Content-Type: application/json" \
-H "Authorization: Bearer DRIVER_ACCESS_TOKEN" \
-d '{
  "isOnline": true,
  "latitude": 25.2854,
  "longitude": 51.5310,
  "address": "Doha, Qatar"
}'
```

**Expected:** `200 OK` with `"isOnline": true`

#### C. Test Nearby Drivers Query

```bash
curl "https://dev.resq-qa.com/api/v1/user/nearby-drivers?latitude=25.2854&longitude=51.5310&radius=10" \
-H "Authorization: Bearer USER_ACCESS_TOKEN"
```

**Expected:** `200 OK` with drivers array (if driver is online and nearby)

---

## Troubleshooting After Deployment

### Issue: Still getting 0 nearby drivers

**Check:**
1. Is driver actually online? Call `/api/v1/driver/status` to verify
2. Is driver's location saved in MongoDB? Ask DevOps to check database
3. Are geospatial indexes created? Run the rebuild indexes script

**Manual fix if needed:**

```bash
# SSH into AWS server
ssh your-aws-server

# Navigate to app directory
cd /path/to/resq-backend

# Rebuild indexes (one-time)
node scripts/rebuildIndexes.js
```

### Issue: Server returns 502 errors

**Check:**
1. Are there errors in server logs?
2. Is MongoDB connection working?
3. Is Redis trying to connect and failing? (Should be disabled)

**Quick fix:**
- Restart the server/container
- Check `.env` has `REDIS_URL=` (empty, not pointing to localhost)

### Issue: Driver can't go online

**Check:**
1. Is driver sending location data?
2. Check mobile app logs for request body
3. Verify driver's `isLocationEnabled` field in database

**Manual fix:**
```bash
# Update driver directly in MongoDB if needed
# (Ask DevOps or use Mongo Express)
```

---

## Environment Variables to Verify on AWS

Make sure these are set correctly in AWS environment:

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://... # Your production MongoDB
REDIS_URL= # Empty or valid Redis URL
CORS_ORIGIN=https://dev.resq-qa.com # Or specific frontend URL
FIREBASE_SERVICE_ACCOUNT_PATH= # Empty if not using push notifications yet
```

---

## Post-Deployment Monitoring

### Week 1: Monitor these metrics

1. **Driver location updates** - Are they succeeding?
2. **Nearby drivers queries** - Are they returning results?
3. **Server errors** - Any 502s or crashes?
4. **Database query performance** - Are geospatial queries fast?

### Tools to Use

- **Server logs** - Check for errors
- **MongoDB Atlas metrics** - Check query performance
- **APM/monitoring** - Set up if available (New Relic, DataDog, etc.)

---

## Success Criteria

✅ Driver can update location → 200 OK
✅ Driver can go online with location → 200 OK
✅ User can find nearby drivers → Returns driver list
✅ No 502 errors on nearby drivers endpoint
✅ Server logs show "MongoDB Connected"
✅ Server logs show "Database indexes synced"

---

## Rollback Plan (if something breaks)

If deployment causes issues:

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or checkout previous working commit
git log --oneline  # Find working commit hash
git reset --hard COMMIT_HASH
git push --force origin main  # Only if safe to do
```

Ask DevOps to redeploy the previous version if auto-deploy doesn't trigger.

---

## Contact

If issues persist after deployment:
1. Check this checklist first
2. Review server logs
3. Test with debug scripts in `/scripts` folder
4. Contact DevOps team with specific error messages

---

**Last Updated:** 2025-11-08
**Critical Fix:** Driver location sync to MongoDB for geospatial queries
