# 🚀 QUICK START: Deploy to Render

## Pre-Deployment Checklist (Do This First)

### 1. Test DATABASE_URL Locally
```bash
cd server
node test-db-url.js
```
✓ Should show all components are valid and not "base"

### 2. Build the Project
```bash
npm run build
```
✓ Should complete without errors
✓ `.next` directory should exist

### 3. Verify .env.local (Local Testing Only)
```
DATABASE_URL=postgresql://postgres.dcitybxftidseaeogcos:Devarapalli%40019@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
CUSTOMER_JWT_SECRET=ThinavaCustomer@2026Secure
ADMIN_JWT_SECRET=ThinavaAdmin@2026Secure
RIDER_JWT_SECRET=ThinavaRider@2026Secure
RESTAURANT_JWT_SECRET=ThinavaRestaurant@2026Secure
NODE_ENV=production
```

## Render Configuration

### 1. Environment Variables in Render Dashboard

**Go to**: Your Service → Settings → Environment

Add these variables:

```
DATABASE_URL=postgresql://postgres.dcitybxftidseaeogcos:Devarapalli%40019@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

CUSTOMER_JWT_SECRET=ThinavaCustomer@2026Secure
ADMIN_JWT_SECRET=ThinavaAdmin@2026Secure
RIDER_JWT_SECRET=ThinavaRider@2026Secure
RESTAURANT_JWT_SECRET=ThinavaRestaurant@2026Secure

NODE_ENV=production
```

⚠️ **CRITICAL**: 
- Special characters in password MUST be URL-encoded (e.g., @ = %40)
- Double-check DATABASE_URL hostname: `aws-1-ap-south-1.pooler.supabase.com`
- Not just "base" or "localhost"

### 2. Build Command

```
npm run build
```

### 3. Start Command

```
npm run start:prod
```

### 4. Optional Settings

- **Node Version**: Latest LTS (16.x or 18.x)
- **Root Directory**: `/` (default)
- **Auto-Deploy**: Yes (optional, for git auto-deploy)

## Deployment Steps

### Option A: Manual Deploy (Fastest)
1. Set all environment variables in Render (step above)
2. Click **"Manual Deploy"** button in Render dashboard
3. Wait for build to complete
4. Check logs for ✓ success message

### Option B: Git Push Deploy
1. Set all environment variables in Render (step above)
2. Commit your changes: `git add . && git commit -m "Configure Render deployment"`
3. Push to your branch: `git push origin main`
4. Render auto-deploys (if configured)

## Monitoring Deployment

### In Render Logs, Look For:

✅ **Success indicators**:
```
[BACKEND] Database URL validated
[BACKEND] Database connected successfully
[BACKEND] THINAVA SERVER STARTED
[FRONTEND] ▲ Next.js started
[INFO] Services running
```

❌ **Failure indicators**:
```
DATABASE_URL environment variable not set
getaddrinfo ENOTFOUND base
Error: Invalid URL
Connection refused
```

If you see failure indicators, check:
1. Environment variables are set in Render
2. DATABASE_URL is not malformed
3. No typos in variable names

## Testing After Deployment

```bash
# Get your Render URL (e.g., https://thinava.onrender.com)

# Test API health
curl https://thinava.onrender.com/api/health

# Expected response
{"status":"ok","database":"connected",...}

# Test login endpoint
curl https://thinava.onrender.com/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}'
```

## If It Fails: Troubleshooting

### "getaddrinfo ENOTFOUND base"
- ✅ Check DATABASE_URL is set in Render Environment
- ✅ Run `node server/test-db-url.js` locally with same URL
- ✅ Verify hostname is not literally "base"

### "Database connection error"
- ✅ Verify DATABASE_URL format is correct
- ✅ Check password special characters are URL-encoded
- ✅ Confirm Supabase database is accessible from Render

### "Missing required environment variable"
- ✅ Check all JWT secrets are set
- ✅ Verify NODE_ENV is not missing
- ✅ Make sure DATABASE_URL is set (not empty)

### "Cannot find .next directory"
- ✅ Run `npm run build` locally to verify it builds
- ✅ Check build command is set to `npm run build` in Render
- ✅ Make sure .next is in git (or add to .gitignore removal)

## Quick Reference

| What | Where | Value |
|------|-------|-------|
| **Build Command** | Render Settings | `npm run build` |
| **Start Command** | Render Settings | `npm run start:prod` |
| **Port** | Environment Var | `8000` |
| **DATABASE_URL** | Environment Var | `postgresql://...@supabase.com.../postgres` |
| **NODE_ENV** | Environment Var | `production` |

## Important Reminders

1. 🔒 **Keep secrets private** - Don't commit .env.local to git
2. 🌐 **Use HTTPS everywhere** - Render provides free HTTPS
3. 🔄 **Redeploy after env changes** - Click Manual Deploy
4. 📝 **Check logs first** - 95% of issues are in the logs
5. ✅ **Test locally before deploying** - Run `npm run build && npm run start:prod`

## Success!

If you see this in Render logs:
```
╔══════════════════════════════════════════════════════════╗
║        THINAVA PRODUCTION STARTUP SEQUENCE              ║
║  ✓ Backend API:  http://localhost:8000                 ║
║  ✓ Frontend Web: http://localhost:3000                 ║
║  Services running - press Ctrl+C to stop               ║
╚══════════════════════════════════════════════════════════╝
```

Your deployment is successful! 🎉

## Need Help?

1. Read `RENDER_DEPLOYMENT_SETUP.md` for detailed guide
2. Read `DATABASE_URL_FIX_REPORT.md` for technical details
3. Check Render logs for specific error messages
4. Run `node server/test-db-url.js` to validate DATABASE_URL
