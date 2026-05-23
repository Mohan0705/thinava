# Render Deployment Configuration Guide

## CRITICAL: Production Database Connection Setup

This guide addresses the `getaddrinfo ENOTFOUND base` error which indicates DATABASE_URL environment variable is not correctly set in Render.

## Root Cause Analysis

The error "getaddrinfo ENOTFOUND base" means:
- PostgreSQL client is trying to connect to hostname `base` (which does not exist)
- This happens when `DATABASE_URL` environment variable is missing, undefined, or malformed
- The pg module then falls back to its default connection parameters

## Step 1: Verify Render Environment Variables

### In Render Dashboard:

1. Go to your Render service
2. Click **"Environment"** tab in the sidebar
3. Verify DATABASE_URL is present with the **EXACT** format:

```
postgresql://postgres.dcitybxftidseaeogcos:Devarapalli%40019@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

**IMPORTANT:**
- Check spelling: `DATABASE_URL` (not `DB_URL` or `DBURL`)
- Ensure it starts with `postgresql://` (not `postgres://`)
- URL must be complete with username, password, host, port, and database name
- Special characters in password MUST be URL-encoded (@ = %40)

### Step 2: Test DATABASE_URL Connection Locally

Before deploying to Render, test the connection string locally:

```bash
cd server

# Run the diagnostic tool
node test-db-url.js
```

This will:
1. ✓ Verify DATABASE_URL is loaded
2. ✓ Parse the URL and display all components
3. ✓ Check hostname is NOT "base"
4. ✓ Test pg module pool creation
5. ✓ Report all errors clearly

### Step 3: Verify .env.local Format

Your local `.env.local` should have:

```env
DATABASE_URL=postgresql://postgres.dcitybxftidseaeogcos:Devarapalli%40019@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
PORT=5000
NODE_ENV=development

CUSTOMER_JWT_SECRET=ThinavaCustomer@2026Secure
ADMIN_JWT_SECRET=ThinavaAdmin@2026Secure
RIDER_JWT_SECRET=ThinavaRider@2026Secure
RESTAURANT_JWT_SECRET=ThinavaRestaurant@2026Secure
```

### Step 4: Deployment Checklist

Before deploying to Render:

- [ ] DATABASE_URL environment variable is set in Render
- [ ] Hostname in DATABASE_URL is: `aws-1-ap-south-1.pooler.supabase.com`
- [ ] Special characters in password are URL-encoded
- [ ] NODE_ENV is set to `production` (for production deployment)
- [ ] All JWT secrets are configured (CUSTOMER_JWT_SECRET, ADMIN_JWT_SECRET, RIDER_JWT_SECRET, RESTAURANT_JWT_SECRET)
- [ ] Database URL test passes locally: `node server/test-db-url.js`

### Step 5: Deployment Redeploy Process

After setting environment variables in Render:

1. Click **"Manual Deploy"** button in Render dashboard
2. Or push a new commit to trigger automatic deployment
3. Monitor the deployment logs for the database connection message:
   ```
   Database URL validated
   Database connected successfully
   ```

## Troubleshooting

### If you still get "getaddrinfo ENOTFOUND base":

1. **Check Render Logs:**
   - Go to Render service dashboard
   - Click **"Logs"** tab
   - Look for startup messages about DATABASE_URL
   - The server will fail fast with clear error message if DATABASE_URL is missing

2. **Run diagnostic tool:**
   ```bash
   node server/test-db-url.js
   ```

3. **Verify environment variable propagation:**
   - In Render dashboard, go to Environment
   - Temporarily add a test variable (e.g., `TEST_VAR=hello`)
   - Check Render logs to confirm it's being loaded
   - This verifies Render is correctly loading environment variables

4. **Check for typos:**
   - Variable name: `DATABASE_URL` (not `DB_URL`, `DATABASE_URL_STRING`, etc.)
   - Make sure there are no leading/trailing spaces in the value

5. **Test with minimal connection string:**
   - First verify basic connectivity works
   - Use the exact format: `postgresql://user:pass@host:port/database`
   - Don't include any extra parameters or query strings

## Build Command Verification

Your build command in Render should be:
```bash
npm run build
```

And start command should be:
```bash
npm start
```

Which runs:
```bash
npm run build && npm run start:prod
```

In package.json:
```json
{
  "scripts": {
    "build": "next build",
    "start": "npm run build && npm run start:prod",
    "start:prod": "NODE_ENV=production node server/src/index.js & NODE_ENV=production next start"
  }
}
```

## Expected Startup Output

When deployment is successful, you should see:

```
╔══════════════════════════════════════════════╗
║           THINAVA SERVER STARTED             ║
╠══════════════════════════════════════════════╣
║  Environment: production                     ║
║  Port:        8000                           ║
║  Frontend:    https://your-render-domain.onrender.com
║  Database:    ✓ configured                   ║
║  JWT Secrets: ✓ ✓ ✓ ✓                        ║
╚══════════════════════════════════════════════╝
```

And in logs:
```
[DB] Database URL validated
[DB] hostname: aws-1-ap-south-1.pooler.supabase.com
[DB] port: 6543
[DB] database: /postgres
[DB] Database connected successfully
```

## Common Mistakes

1. ❌ `DB_URL` instead of `DATABASE_URL`
2. ❌ `postgres://` instead of `postgresql://`
3. ❌ Password not URL-encoded (@ character not escaped as %40)
4. ❌ Missing port number (:6543)
5. ❌ Missing database name (/postgres)
6. ❌ Hostname is just "base" instead of actual Supabase host
7. ❌ NODE_ENV not set to `production` in production deployment

## Success Criteria

After deployment, verify:

1. ✓ Server starts without "getaddrinfo ENOTFOUND base" error
2. ✓ Database connection logs show successful connection
3. ✓ API endpoints respond with 200/404 status (not 503)
4. ✓ `/api/health` endpoint returns `{ status: "ok", database: "connected" }`
5. ✓ Customer login/signup works end-to-end
6. ✓ Realtime socket connections established successfully

## Questions?

If deployment still fails after following these steps:
1. Check Render error logs for the exact error message
2. Verify DATABASE_URL format matches Supabase connection string exactly
3. Run `node server/test-db-url.js` locally with same DATABASE_URL
4. If local test passes but Render fails, check Render environment variable settings
