# Restaurant Auth & Rider Timer Fix Report

## Issue 1 — Newly Registered Restaurants Cannot Login

### Root Causes Found

**Root Cause A: Password length validation mismatch**
- **Signup** (`restaurant-auth.js:124`): required `min 6` characters
- **Login validator** (`authValidators.js:5`): required `min 8` characters
- A user who signed up with a 6 or 7 character password would pass signup validation, but the login endpoint's express-validator would reject the request with a 400 "Validation failed" before ever reaching the auth service.

**Root Cause B: Missing restaurant approval status check in login service**
- The login service (`authService.js`) only checked `owner.is_active` (which defaults to `TRUE`). It did **not** check the restaurant's `status` field.
- A self-registered restaurant with `status = 'PENDING_APPROVAL'` could log in and access the panel. While this didn't cause the "Invalid email or password" error, it was an authorization bypass.

**Root Cause C: Missing restaurant approval status check in auth middleware**
- The `authenticateRestaurantOwner` middleware also only checked `is_active`, not the restaurant's approval status, allowing unapproved restaurants to access all panel routes after obtaining a token.

### Fixes Applied

| File | Change |
|------|--------|
| `server/src/routes/restaurant-auth.js:124` | Changed password min length from 6 to 8 to match login validator |
| `server/src/modules/restaurantPanel/services/authService.js` | Added structured `logger.info/warn` calls. Added restaurant status checks for PENDING_APPROVAL, REJECTED, and SUSPENDED. Returns clear messages instead of generic "Invalid email or password". |
| `server/src/modules/restaurantPanel/middleware/auth.js` | Added restaurant status check — blocks PENDING_APPROVAL, REJECTED, and SUSPENDED restaurants with appropriate messages. |

### Approval Flow Now

```
SIGNUP → status='PENDING_APPROVAL' → Cannot login → "Pending approval from THINAVA admin"
ADMIN APPROVES → status='OPEN' → Can login → Panel access granted
ADMIN REJECTS → status='REJECTED' → Cannot login → "Account has been rejected"
SUSPENDED → status='SUSPENDED' → Cannot login → "Account has been suspended"
```

---

## Issue 2 — Rider Online Time Resets on Refresh

### Root Cause

The timer was **entirely client-side** with no server persistence:
- `online_minutes_today` was defined in the schema (default 0) and read in the profile query, but **no backend code ever updated it**
- The dashboard started a `setInterval` from `Date.now()` at mount time, calculating elapsed seconds locally
- On page refresh, the timer always reset to `0h 0m` because the base `online_minutes_today` was always 0 and there was no `online_since` timestamp

### Solution: Persistent `online_since` Timestamp

**Architecture:**

```
[Go Online] → SET is_online=true, online_since=CURRENT_TIMESTAMP
[Go Offline] → SET is_online=false, online_since=NULL
[Profile Load] → Return online_since to client
[Timer Calc] → Date.now() - online_since (persists across refresh)
```

### Files Modified

| File | Change |
|------|--------|
| `server/src/database/ensureDeliveryLogisticsSchema.js:27` | Added `online_since TIMESTAMP` column to `delivery_partners` |
| `server/src/modules/delivery/services/authService.js` | `setDeliveryPartnerOnlineStatus`: sets `online_since = CURRENT_TIMESTAMP` when going online, `NULL` when offline. Profile query now returns `online_since`. |
| `server/src/modules/delivery/controllers/authController.js` | Returns `online_since` in the online status response |
| `src/types/delivery.ts` | Added `online_since?: string \| null` to `DeliveryPartner` type |
| `src/lib/delivery-api.ts` | Added `online_since` to `setOnlineStatus` response type |
| `src/app/delivery/dashboard/page.tsx` | Timer now calculates `Date.now() - new Date(online_since).getTime()` instead of using local `Date.now()` baseline. Added `partner?.online_since` as effect dependency. Updates local `online_since` after toggle. |

### Timer Behavior After Fix

```
10:00 AM → Go Online → DB: online_since = 10:00:00
10:45 AM → Refresh page → Profile returns online_since = 10:00:00
         → Dashboard shows 0h 45m (calculated from server timestamp)
10:50 AM → Go Offline → DB: online_since = NULL
         → Timer shows 0h 0m
```

---

## Build Verification

| Check | Result |
|-------|--------|
| Frontend TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Delivery auth middleware loads | ✅ |
| Delivery authService loads | ✅ |
| Delivery controller loads | ✅ |
| Delivery routes load | ✅ |
| Restaurant auth service loads | ✅ |
| Restaurant controller loads | ✅ |
| Restaurant auth middleware loads | ✅ |
| Restaurant panel routes load | ✅ |
| Restaurant-auth routes load | ✅ |

---

## Files Summary

### Modified for Issue 1 (Restaurant Auth)
| File | Lines | Change |
|------|-------|--------|
| `server/src/routes/restaurant-auth.js` | 124 | Password min length: 6 → 8 |
| `server/src/modules/restaurantPanel/services/authService.js` | 1-110 | Added logger, approval status checks, structured logging |
| `server/src/modules/restaurantPanel/middleware/auth.js` | 34-50 | Added restaurant status check blocking unapproved/suspended |

### Modified for Issue 2 (Rider Timer)
| File | Lines | Change |
|------|-------|--------|
| `server/src/database/ensureDeliveryLogisticsSchema.js` | 27 | Added `online_since TIMESTAMP` column |
| `server/src/modules/delivery/services/authService.js` | 184-212 | `online_since` set on online, cleared on offline; added to profile query |
| `server/src/modules/delivery/controllers/authController.js` | 120 | Returns `online_since` in response |
| `src/types/delivery.ts` | 46 | Added `online_since?: string \| null` |
| `src/lib/delivery-api.ts` | 54 | Added `online_since` to response type |
| `src/app/delivery/dashboard/page.tsx` | 63-82, 147 | Timer uses `online_since`; updates local state after toggle |
