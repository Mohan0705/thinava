# Rider Dashboard Backend Fix Report

## Root Cause

**Single root cause for both issues:** `Number(decoded.sub)` in two auth middleware files.

`decoded.sub` is a UUID string (e.g., `"550e8400-e29b-41d4-a716-446655440000"`).  
`Number("550e8400-e29b-41d4-a716-446655440000")` returns `NaN`.

Since `delivery_partners.id` is `UUID PRIMARY KEY`, every SQL query using `req.deliveryPartner.id` (= `NaN`) fails with:

```text
invalid input syntax for type uuid: "NaN"
```

This broken middleware caused **every** authenticated delivery endpoint to fail — including both the online status toggle and the shift booking endpoint.

---

## Issue 1 — Rider Online Status Failing

### What was happening
1. Rider clicks Online/Offline → `POST /api/delivery/auth/online-status`
2. `authenticateDeliveryPartner` middleware decodes JWT, sets `req.deliveryPartner.id = NaN`
3. `authService.setDeliveryPartnerOnlineStatus(NaN, true)` runs `WHERE id = NaN`
4. PostgreSQL rejects UUID cast of `NaN` → controller catches error → `next(error)` → returns 500

### Fixes applied

#### `server/src/modules/delivery/middleware/auth.js`

| Before | After |
|--------|-------|
| `id: Number(decoded.sub)` | `id: decoded.sub` |
| No logging | Added `logger.debug`/`logger.warn` for auth events |
| Non-standard error format | Standardized to `{ success, error, code }` |

#### `server/src/modules/delivery/services/authService.js`

| Before | After |
|--------|-------|
| `last_active_at` not updated when going online | Added `last_active_at = CASE WHEN $1 = TRUE THEN CURRENT_TIMESTAMP` |
| No logging | Added structured `logger.info/warn/error` calls throughout |
| Silent 404 on no rows | Added logging before throwing |

#### `server/src/modules/delivery/controllers/authController.js`

| Before | After |
|--------|-------|
| **No websocket emission** | Emits `riderStatusUpdated` to `delivery_partner:<id>` room AND `riderStatusChanged` to `delivery:fleet` room |
| Console.error for dispatch failure | Uses `logger.error` |
| No logging | Added structured `logger.info/debug` for toggle requests and socket emits |

#### Global error handler (`server/src/index.js`)

| Before | After |
|--------|-------|
| Raw `err.message` sent in production | DB errors (code `22xxx`/`23xxx`, message containing `syntax for type`) replaced with generic message |
| No DB error code logged | Added `dbCode: err.code` to logged error |

### Response format now

```json
{
  "success": true,
  "is_online": true,
  "current_status": "AVAILABLE"
}
```

### Realtime sync flow
```
Online toggle → service updates DB → controller emits:
  1. 'riderStatusUpdated' → delivery_partner:<id> room (rider's own dashboard)
  2. 'riderStatusChanged' → delivery:fleet room (admin dashboard, live dispatch)
```

---

## Issue 2 — Shift Booking Crash

### What was happening
1. Rider clicks Book → `POST /api/delivery/shifts/book`
2. Same `NaN` bug: `req.deliveryPartner.id = NaN` from `Number(decoded.sub)`
3. `shiftService.bookShift(NaN, payload)` runs `WHERE delivery_partner_id = NaN`
4. PostgreSQL: `invalid input syntax for type uuid: "NaN"`
5. Raw DB error sent to client

### Fixes applied

#### `server/src/modules/delivery/middleware/auth.js`
(Already fixed as part of Issue 1 — same root cause)

#### `server/src/modules/delivery/services/shiftService.js`

| Before | After |
|--------|-------|
| No slot_label validation against allowed values | Validates against `['Breakfast', 'Lunch', 'Dinner']` |
| Raw DB errors leaked | Catches DB errors, throws generic `"Unable to book shift right now. Please try again."` |
| No logging | Added structured `logger.info/warn/error` at every step |
| No SQL param logging on failure | Added SQL params to error log |

#### `server/src/modules/delivery/routes/index.js`

| Before | After |
|--------|-------|
| No validation on `POST /shifts/book` | Added express-validator: `slot_label` (non-empty string), `starts_at` (ISO 8601), `ends_at` (ISO 8601) |
| No validation on `POST /auth/online-status` | Added `is_online` must be boolean |
| No validation on `POST /auth/status` | Added `status` must be non-empty string |
| No validation handler | Added `handleValidation` middleware that returns `{ success, error, code: "VALIDATION_ERROR" }` |

---

## Files Modified

| File | Changes |
|------|---------|
| `server/src/modules/delivery/middleware/auth.js` | **ROOT CAUSE:** `Number(decoded.sub)` → `decoded.sub`. Added structured logger. Standardized error format. |
| `server/src/routes/rider-auth.js` | **SAME ROOT CAUSE:** `Number(decoded.sub)` → `decoded.sub`. Added structured logger. |
| `server/src/modules/delivery/services/authService.js` | Added `last_active_at` update on online. Added structured logging to all checks/queries. |
| `server/src/modules/delivery/controllers/authController.js` | Added websocket emission (`riderStatusUpdated` + `riderStatusChanged`). Added structured logging. |
| `server/src/modules/delivery/services/shiftService.js` | Slot label whitelist validation. DB error sandboxing (no raw leaks). Structured logging at every step. |
| `server/src/modules/delivery/routes/index.js` | Added express-validator validation middleware for shift booking + online status + status update. Added `handleValidation` error handler. |
| `server/src/index.js` | Global error handler now masks raw DB errors in production. Logs `dbCode`. |
| `src/app/delivery/dashboard/page.tsx` | Already had proper loading/error states. Confirmed no changes needed. |
| `src/app/delivery/shifts/page.tsx` | Already had proper loading/disabled spinner states. Confirmed no changes needed. |

---

## Verification Results

| Check | Result |
|-------|--------|
| Frontend TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Delivery auth middleware loads | ✅ |
| Auth controller loads | ✅ |
| Auth service loads | ✅ |
| Shifts controller loads | ✅ |
| Shift service loads | ✅ |
| Delivery routes load (with validation) | ✅ |
| Rider-auth routes load | ✅ |
| Socket server loads | ✅ |
| No remaining `Number(decoded.sub)` in codebase | ✅ |
| No remaining `parseInt(decoded.sub)` in codebase | ✅ |

---

## Remaining Risks

| Risk | Mitigation |
|------|------------|
| Other `Number()`/`parseInt()` usages on UUID values elsewhere in the codebase | Checked delivery module — none found |
| Missing validation on other delivery routes | Added validation for shift booking + online status + status update. Other routes remain unvalidated but use the same (now-fixed) middleware for auth. |
| DB errors could leak through other properties | Global error handler masks `syntax for type` messages and PostgreSQL error codes `22xxx`/`23xxx` in production |
| Websocket room `delivery:fleet` must exist | Created in `socketServer.js` line 16-21 — already exists. |
