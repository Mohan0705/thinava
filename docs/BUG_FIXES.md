# THINAVA Bug Fixes

Permanent bug history for the THINAVA food delivery platform.

---

## Bug 1: CASCADE Delete Crashes in Customer Review Submission

**Date Found:** April/May 2026
**Severity:** Critical

### Root Cause
PostgreSQL `ON DELETE CASCADE` constraints on `menu_items.restaurant_id` and `restaurant_reviews.restaurant_id`. When an admin deleted a restaurant or menu item, all related menu_items and reviews were cascade-deleted. The customer review page `src/app/admin/reviews/page.tsx` called `restaurant.menu_items.find()` without null-checking `menu_items`, causing a crash when the array was undefined.

Similarly, `src/app/api/admin/reviews/route.ts` called `.find()` on `restaurant?.menu_items` without defensive check.

### Symptoms
- 500 error when admin visits Reviews page after deleting a menu item
- Server crash: `Cannot read properties of undefined (reading 'find')`
- Blank admin page with no error UI
- Review submission endpoint returns 500 when the referenced menu item is gone

### Fix Applied
- **`src/app/admin/reviews/page.tsx`**: Added null check `restaurant?.menu_items` before `.find()`
- **`src/app/api/admin/reviews/route.ts`**: Added null check for `restaurant?.menu_items` before `.find()`; returns 400 with message if item not found

### Files Changed
- `src/app/admin/reviews/page.tsx`
- `src/app/admin/reviews/route.ts`

### Prevention Strategy
- Always use optional chaining (`?.`) when accessing DB-joined data that could have been cascade-deleted
- Consider soft-delete pattern for menu items and restaurants
- Add defensive null checks in ALL admin pages that read related data (reports, analytics)

---

## Bug 2: Invalid UUID Causes 500 in Review Submission

**Date Found:** April 2026
**Severity:** High

### Root Cause
Server-side route `/api/reviews` only validates `rider_id` with a UUID regex but does NOT validate `restaurant_id` or `order_id`. Passing an invalid UUID string causes a PostgreSQL error (`invalid input syntax for type uuid`).

### Symptoms
- 500 error with raw PG error message leaked to client
- Invalid UUID passed from frontend results in unhandled DB exception

### Fix Applied
Added UUID regex validation for `order_id`, `restaurant_id`, and `rider_id` in the reviews route before DB queries.

### Files Changed
- `server/src/routes/reviews.js`

### Prevention Strategy
- Create a shared `ensureUuid()` utility (exists in `locationService.js`)
- Apply UUID validation to ALL route params across the entire API
- Use PostgreSQL `$1::uuid` cast syntax as a safety net (throws descriptive error)

---

## Bug 3: Failed Fetch on Admin Action Buttons

**Date Found:** April 2026
**Severity:** High

### Root Cause
Admin order management page used direct Supabase client mutations for order status updates (ship, deliver, cancel). Supabase REST calls were failing due to RLS policy mismatches and auth context issues in the admin scope.

### Symptoms
- "Failed to update order status" toast errors in admin panel
- Buttons appear to do nothing when clicked
- Console shows Supabase auth errors

### Fix Applied
- Migrated all admin order mutations from direct Supabase queries to REST API routes
- Created `PATCH /api/admin/orders/ship`
- Created `PATCH /api/admin/orders/deliver`
- Created `PATCH /api/admin/orders/cancel`
- Each validates order existence, updates status, and returns proper responses
- Frontend updated to call API routes instead of Supabase direct

### Files Changed
- `src/app/api/admin/orders/ship/route.ts` (new)
- `src/app/api/admin/orders/deliver/route.ts` (new)
- `src/app/api/admin/orders/cancel/route.ts` (new)
- `src/app/admin/manage-orders/page.tsx`
- `src/app/api/admin/orders/route.ts`

### Prevention Strategy
- All admin mutations should go through REST API routes, not direct DB access
- Centralize order status transitions through a single service layer
- Use session-based admin auth in API routes

---

## Bug 4: Inconsistent Order Status

**Date Found:** April 2026
**Severity:** Medium

### Root Cause
Admin order list was sorting by `createdAt` (camelCase) which doesn't exist in the database. The actual column is `created_at` (snake_case). This caused incorrect sort order.

### Symptoms
- Admin order list shows orders in wrong order (not chronological)
- Newest orders appear at the bottom

### Fix Applied
- Changed sort key from `createdAt` to `created_at` in admin order queries

### Files Changed
- `src/app/admin/manage-orders/page.tsx`

### Prevention Strategy
- Maintain consistent snake_case naming for DB columns
- Use TypeScript types that map DB columns accurately

---

## Bug 5: Review Modal Validation Issues

**Date Found:** April 2026
**Severity:** Medium

### Root Cause
Review modal in customer orders page allowed submitting ratings without validating that the order status is `delivered`. Users could attempt to rate orders that were still in progress.

### Symptoms
- API returns 400 "Order not delivered" with no user-friendly error
- Confusing UX — user submits rating but nothing happens

### Fix Applied
- Frontend: Only show "Rate Order" button when `statusNormalized === 'delivered'`
- Backend: Server-side check validates order status before accepting review

### Files Changed
- `src/app/orders/page.tsx`
- `server/src/routes/reviews.js`

### Prevention Strategy
- Always validate state on both frontend and backend
- Show "Already Reviewed" state for already-rated delivered orders

---

## Bug 6: Google Maps API Loading Issues

**Date Found:** April 2026
**Severity:** Medium

### Root Cause
Google Maps SDK loader (`google-maps.ts`) could fail silently when the API key was missing, network was slow, or the script loaded multiple times. No retry logic or idempotent loading.

### Symptoms
- Location picker shows blank map or "google is not defined" error
- Address autocomplete broken
- Delivery map doesn't render

### Fix Applied
- Created dynamic Google Maps SDK loader with:
  - Idempotent loading (prevents duplicate script injection)
  - Retry logic with exponential backoff
  - Proper Promise-based API that resolves/rejects cleanly

### Files Changed
- `src/lib/google-maps.ts`

### Prevention Strategy
- Always use a dynamic loader pattern for third-party SDKs
- Implement retry with backoff for network-dependent scripts
- Graceful fallback UI when Maps fails to load

---

## Bug 7: Restaurant Auth Mismatch

**Date Found:** April 2026
**Severity:** High

### Root Cause
Restaurant owner auth system had two parallel implementations: the `restaurant-auth` routes (Express server) and the `restaurant` panel routes (Express modules). These used different middleware (`authenticateRestaurant` vs `authenticateRestaurantOwner`) and different token formats, causing auth mismatches.

### Symptoms
- Restaurant owner logs in but gets 401 on panel pages
- Token from one endpoint doesn't work on another
- Session persistence broken between auth flows

### Fix Applied
- Consolidated restaurant auth to use a single middleware (`authenticateRestaurantOwner`)
- Standardized JWT token format and expiry (7 days)
- Unified login endpoint
- Frontend store (`restaurantOwnerAuthStore.ts`) updated to use consistent token

### Files Changed
- `server/src/routes/restaurant-auth.js`
- `server/src/modules/restaurantPanel/routes/authRoutes.js`
- `server/src/middleware/`
- `src/store/restaurantOwnerAuthStore.ts`

### Prevention Strategy
- Single source of truth for each auth scope
- One middleware per role, shared across all routes
- Validate token format on both issue and verify

---

## Bug 8: Order State Mutation Bugs

**Date Found:** April 2026
**Severity:** High

### Root Cause
Order status could be updated to invalid states (e.g., `delivered` → `placed`, or `cancelled` → `preparing`). No state machine validation existed — any status string could be written to the DB.

### Symptoms
- Orders in unrecoverable states
- Data integrity issues in analytics
- Delivery flow broken for orders in wrong states

### Fix Applied
- Implemented `validateOrderTransition()` function in `orderLifecycleService.js`
- Valid transitions only:
  - `placed` → `accepted` → `preparing` → `ready_for_pickup` → `out_for_delivery` → `delivered`
  - Any state → `cancelled` (allowed from all states)
- Applied validation to all order status update endpoints
- Added `order_status_history` audit table to track all transitions

### Files Changed
- `server/src/services/orderLifecycleService.js`
- `server/src/routes/orders.js`
- `server/src/routes/orders-advanced.js`
- `server/src/routes/admin/index.js`

### Prevention Strategy
- Every status update must go through `validateOrderTransition()`
- Log all transitions to `order_status_history` for audit
- Frontend should only show valid next-status actions
- Block terminal states (delivered, cancelled) from further updates

---

## Summary of Vulnerabilities (Unfixed)

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| No UUID validation on route params | `orders.js`, `menu.js`, `admin-extended.js` | High | Invalid UUID causes PG error; use `ensureUuid()` from locationService |
| Raw `err.message` exposed to clients | Multiple routes | Medium | Production should sanitize error messages |
| `window.prompt()` for cancellation reason | `admin/orders/page.tsx:72` | Low | Poor UX; use modal instead |
| `legacyAddressId` dependency | `checkout/page.tsx:226` | Medium | May be undefined for new users |
| Dev endpoints exposed | `server/src/index.js` | Medium | Blockable via NODE_ENV check |
| Console.log on route mount | `server/src/index.js` | Low | Cleanup recommended for production |
| Two parallel coupon tables | `coupons` + `coupon_codes` | Medium | Contains similar data; consolidate |
| Inconsistent delivery ETA | `orders.js` (25-35m) vs `orders-advanced.js` (45m) | Low | Standardize |

---

## Bug Prevention Checklist

For all new code, verify:

- [ ] UUID validation on ALL route params and request body IDs
- [ ] Optional chaining on all joined/nested data access
- [ ] `client.release()` in `finally` block on pool connections
- [ ] `BEGIN`/`COMMIT`/`ROLLBACK` for multi-table writes
- [ ] State machine validation for order status changes
- [ ] Input sanitization on user-submitted text
- [ ] Rate limiting on auth/OTP endpoints
- [ ] CORS and auth middleware on all protected routes
- [ ] Error responses do not leak raw DB errors or stack traces
- [ ] Frontend error states render fallback UI (not blank)
