# Production CORS & API Configuration Fix - Deployment Instructions

**Issue**: Frontend (Vercel) was trying to call localhost:5000 API, getting CORS errors  
**Root Cause**: Hardcoded localhost fallbacks in API config and backend CORS  
**Fix Applied**: Removed localhost fallbacks, enforced environment variable configuration

---

## What Was Fixed

### 1. ✅ Frontend API Configuration (`src/config/api.ts`)
- **BEFORE**: `'http://localhost:5000/api'` hardcoded fallback
- **AFTER**: Uses `NEXT_PUBLIC_API_URL` from environment (must be set in Vercel)
- **Commit**: `dbad9c1`

### 2. ✅ Backend CORS Configuration (`server/src/config/env.js`)
- **BEFORE**: `FRONTEND_URL: { default: 'http://localhost:3000' }` - allowed localhost in production!
- **AFTER**: Removed localhost default, validates production URLs explicitly
- **Production Enforcement**: If `NODE_ENV=production` and FRONTEND_URL is missing or contains localhost → **BUILD FAILS** with clear error
- **Commit**: `dbad9c1`

### 3. ✅ Socket.IO CORS Fix (`server/src/index.js`)
- **BEFORE**: `{ origin: env.FRONTEND_URL }` (wrong parameter name)
- **AFTER**: `{ corsOrigin: env.FRONTEND_URL }` (correct)
- **Commit**: `dbad9c1`

---

## Deployment Steps

### STEP 1: Configure Render Environment Variables

**Go to**: https://dashboard.render.com → Your THINAVA Service → Environment

**Add/Update these variables** (DO NOT use localhost):

```env
NODE_ENV=production
FRONTEND_URL=https://thinava.vercel.app
DATABASE_URL=postgresql://postgres.dcitybxftidseaeogcos:Devarapalli%40019@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
CUSTOMER_JWT_SECRET=ThinavaCustomer@2026Secure
ADMIN_JWT_SECRET=ThinavaAdmin@2026Secure
RIDER_JWT_SECRET=ThinavaRider@2026Secure
RESTAURANT_JWT_SECRET=ThinavaRestaurant@2026Secure
```

⚠️ **CRITICAL**: 
- `FRONTEND_URL` MUST be `https://thinava.vercel.app` (NOT localhost!)
- If FRONTEND_URL is missing or has localhost, Render deployment will **FAIL** with error message

### STEP 2: Configure Vercel Environment Variables

**Go to**: Vercel Dashboard → Project Settings → Environment Variables

**Add/Update these variables**:

```env
NEXT_PUBLIC_API_URL=https://thinava.onrender.com/api
NEXT_PUBLIC_SOCKET_URL=https://thinava.onrender.com
```

⚠️ **CRITICAL**:
- `NEXT_PUBLIC_API_URL` = Your Render backend URL + `/api`
- `NEXT_PUBLIC_SOCKET_URL` = Your Render backend URL (without `/api`)
- Replace `https://thinava.onrender.com` with your actual Render URL

### STEP 3: Rebuild Render Deployment

1. Go to https://dashboard.render.com → THINAVA Service
2. Click **"Manual Deploy"** (or wait for auto-deploy from git push)
3. Watch build logs - should see:
   ```
   Database connected successfully
   Server listening on port 8000
   All routes mounted
   ```

**If deployment FAILS**, check logs for:
```
✗ In production, FRONTEND_URL must be set to your production domain
```
→ Solution: Go back to STEP 1 and verify FRONTEND_URL is set correctly

### STEP 4: Rebuild Vercel Deployment

1. Go to Vercel Project Dashboard
2. **Deployments** tab → **Redeploy** latest commit
   - OR trigger redeploy from git push
3. Wait for build to complete
4. Should see logs showing Next.js building successfully

### STEP 5: Verify the Fix

**Test 1: Check Browser Network Tab**
1. Open https://thinava.vercel.app
2. Open DevTools → Network tab
3. **Verify**:
   - API calls go to `https://thinava.onrender.com/api/*` (NOT localhost!)
   - NO CORS errors
   - Requests show `200 OK` status

**Test 2: Load Restaurants**
1. Navigate to homepage
2. **Verify**: Restaurants load successfully (no CORS error)
3. Click on a restaurant → should load menu
4. **Verify**: Menu items load from API

**Test 3: Real-time Features**
1. Open rider dashboard (or customer dashboard)
2. Open DevTools → Console
3. **Verify**: WebSocket connects to `https://thinava.onrender.com` (NOT localhost!)
4. Should see Socket.IO connection messages

---

## What Should NOT Happen

❌ Frontend should **NOT** make requests to `http://localhost:5000`  
❌ Backend should **NOT** CORS-allow `http://localhost:3000`  
❌ Socket.IO should **NOT** accept connections from localhost  
❌ No CORS error messages in browser console  

---

## Troubleshooting

### Issue: CORS Error Still Appears
**Solution**: 
- Verify NEXT_PUBLIC_API_URL is set in Vercel
- Verify FRONTEND_URL is set in Render
- Verify both services use new commit `dbad9c1`
- Clear browser cache (Ctrl+Shift+Delete)

### Issue: Render Deployment Fails with "FRONTEND_URL must be set"
**Solution**:
- Go to Render Environment Variables
- Add `FRONTEND_URL=https://thinava.vercel.app`
- Click **"Manual Deploy"** again

### Issue: API calls timeout or connection refused
**Solution**:
- Verify NEXT_PUBLIC_API_URL points to correct Render domain
- Check Render backend is running (should see "Server listening on port 8000")
- Verify DATABASE_URL in Render is correct

---

## Environment Variable Reference

| Service | Variable | Value | Purpose |
|---------|----------|-------|---------|
| **Render** | NODE_ENV | `production` | Activates validation checks |
| **Render** | FRONTEND_URL | `https://thinava.vercel.app` | CORS origin for requests |
| **Render** | DATABASE_URL | PostgreSQL connection string | Database access |
| **Vercel** | NEXT_PUBLIC_API_URL | `https://thinava.onrender.com/api` | Frontend API endpoint |
| **Vercel** | NEXT_PUBLIC_SOCKET_URL | `https://thinava.onrender.com` | WebSocket endpoint |

---

## Architecture After Fix

```
┌─────────────────────────────┐
│  Browser (thinava.vercel.app)│
└────────────┬────────────────┘
             │
             ├─ API: https://thinava.onrender.com/api/*
             └─ WebSocket: https://thinava.onrender.com (Socket.IO)
                       │
                       └──────────────────────────┐
                                                  │
                       ┌──────────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  Render Backend (Node.js)    │
        │  - Express API               │
        │  - Socket.IO Server          │
        │  - Port 8000                 │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Supabase PostgreSQL         │
        │  (ap-south-1)                │
        └──────────────────────────────┘
```

**Key Change**: Frontend no longer tries localhost; all requests go through environment-configured production URLs.

---

## Git Commit

**Commit Hash**: `dbad9c1`  
**Files Changed**: 
- `src/config/api.ts` - Frontend API config
- `server/src/config/env.js` - Backend environment validation
- `server/src/index.js` - Socket.IO CORS parameter fix

**Changes Available At**: https://github.com/Mohan0705/thinava/commit/dbad9c1

---

## Next Steps

1. ✅ Code pushed to GitHub (commit `dbad9c1`)
2. 🔲 **SET Render environment variables** (STEP 1 above)
3. 🔲 **SET Vercel environment variables** (STEP 2 above)
4. 🔲 **Redeploy Render** (STEP 3 above)
5. 🔲 **Redeploy Vercel** (STEP 4 above)
6. 🔲 **Verify in browser** (STEP 5 above)

Once these are done, production should work fully without localhost dependencies!
