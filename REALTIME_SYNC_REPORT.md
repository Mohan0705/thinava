# Phase 5 — Realtime Sync Architecture Report

## Issues Found

### 1. Runtime Crash: `emitToRoom` Imported But Not Exported
**File**: `server/src/realtime/orderEvents.js:2`
```js
const { emitToRoom, ROOMS } = require('./socketServer')
```
`socketServer.js` did **not** export `emitToRoom`. Every call to `emitOrderScopedUpdate` silently failed because `emitToRoom` was `undefined`. All order lifecycle, delivery, and location socket events were dead letters.

**Fix**: Added `emitToRoom()` to `socketServer.js` — a helper that calls `io.to(room).emit(event, data)` with `_meta.timestamp`. Exported alongside existing symbols.

### 2. Runtime Crash: `getIoInstance` Imported But Not Exported
**Files**: 
- `server/src/modules/delivery/services/deliveryCompletionService.js`
- `server/src/modules/orders/orderLifecycleService.js`
- `server/src/modules/delivery/services/supportService.js`

Three service files import `{ getIoInstance }` from `socketServer.js`, but the module only exported `getIO`. This was a guaranteed runtime crash on any code path reaching these files.

**Fix**: Added `getIoInstance` as a direct alias of `getIO` in `socketServer.js` exports.

### 3. Dual Real-time Event Systems
There are **two parallel event emission systems** on the server:

| System | File | Events | Used By |
|--------|------|--------|---------|
| `orderEvents.js` | `server/src/realtime/orderEvents.js` | `admin:order_updated`, `customer:order_updated`, `delivery:active_order_updated`, `delivery:offer_*`, `delivery:status_updated`, `delivery:location_updated` | admin, delivery, restaurant services |
| `socketEventsHandler.js` | `server/src/realtime/socketEventsHandler.js` | `orderAssigned`, `orderAccepted`, `orderRejected`, `orderPickedUp`, `orderDelivered`, `riderLocationUpdated`, `orderRated`, `restaurantStatusUpdated`, `rider*`, etc. | orderLifecycleService, deliveryCompletionService, settingsController |

Both systems emitted overlapping events (e.g., `orderAssigned` fires from both), creating duplicate network traffic and potential race conditions on the frontend.

**Fix**: Refactored `socketEventsHandler.js` to:
- Use centralized `getIO()` and `emitToRoom()` from `socketServer.js`
- Delegate order lifecycle events (`emitOrderAccepted`, `emitOrderPickedUp`, `emitOrderDelivered`) through `orderEvents.js` first (for structured snapshots), then emit legacy event names as backward-compatible aliases
- Remove constructor parameter `io` — now uses the singleton IO instance

### 4. SocketEventsHandler Constructor Pattern Was Fragile
The pattern:
```js
const io = getIoInstance()
const socketHandler = io ? new SocketEventsHandler(io) : null
```
Required null-checking `socketHandler` at every call site (6 locations across 2 files). If `getIoInstance` returned null (e.g., if called before socket server initialized), all events silently dropped.

**Fix**: `SocketEventsHandler` no longer takes `io` in its constructor. Every method calls `getIO()` internally, returning early if the server isn't initialized. All `if (socketHandler)` guards removed.

### 5. Frontend Event Name Mismatches
Frontend pages listened for events the server never emitted:

| Frontend Listens For | Server Actually Emits |
|---------------------|----------------------|
| `restaurantStatusChanged` (admin restaurants page) | `restaurantStatusUpdated` |
| `riderStatusChanged` (admin delivery partners page) | Not emitted anywhere |
| `menuUpdated` (admin menu page) | Not emitted anywhere |

These were dead subscriptions — the pages still worked because they also poll.

**Fix**: Centralized all admin socket subscriptions through `useAdminRealtimeSync` which triggers a full data refetch on any admin-scoped event, ensuring consistent state.

### 6. Admin Dashboard / Orders Page Used Only Polling
Dashboard (15s interval) and orders page (12s interval) relied entirely on polling. No live socket subscription meant stale data between poll cycles.

**Fix**: Added `useAdminRealtimeSync` hook to both pages that calls `refetch()` on any incoming admin event, cutting effective staleness from 12-15s to near-zero.

## Files Modified

### Server
| File | Change |
|------|--------|
| `server/src/realtime/socketServer.js` | Added `emitToRoom()` function; added `getIoInstance` as alias of `getIO` |
| `server/src/realtime/socketEventsHandler.js` | Full rewrite: uses `getIO()`/`emitToRoom()` singleton; delegates order events through `orderEvents.js`; no-constructor pattern |
| `server/src/modules/delivery/services/deliveryCompletionService.js` | Replaced `getIoInstance` → `getIO`; removed null-guard pattern; `SocketEventsHandler` now needs no io arg |
| `server/src/modules/orders/orderLifecycleService.js` | Same as above |
| `server/src/modules/delivery/services/supportService.js` | `getIoInstance()` → `getIO()` |
| `server/src/modules/restaurantPanel/controllers/settingsController.js` | Removed `req.app.get('io')` — `SocketEventsHandler` uses singleton internally |

### Frontend
| File | Change |
|------|--------|
| `src/lib/realtimeManager.ts` | **New** — centralized socket lifecycle manager with typed event subscription, Zustand store sync, admin realtime sync |
| `src/features/admin/use-admin-query.ts` | Added `refetch()` method; changed to use refs for latest loader |
| `src/app/admin/dashboard/page.tsx` | Added `useAdminRealtimeSync` to trigger `refetch()` on socket events |
| `src/app/admin/orders/page.tsx` | Added `useAdminRealtimeSync` to trigger `refresh()` on socket events |
| `src/app/admin/restaurants/page.tsx` | Replaced `getRealtimeSocket`/manual listener with `useAdminRealtimeSync` |
| `src/app/admin/delivery-partners/page.tsx` | Replaced `getRealtimeSocket`/manual listener with `useAdminRealtimeSync` |
| `src/app/admin/restaurants/[id]/menu/page.tsx` | Replaced `getRealtimeSocket`/manual listener with `useAdminRealtimeSync` |

## Testing Verification
- All 12+ server modules load successfully (ECONNREFUSED from DB is expected in isolated test env)
- Frontend TypeScript: **0 errors**
- All realtime event flows now route through a single `emitToRoom` function with consistent `_meta` envelope

## Architecture After Phase 5

```
┌─────────────────────────────────────────────────────────────┐
│                    socketServer.js                          │
│  createSocketServer  getIO  emitToRoom  ROLES  ROOMS        │
│                     (singleton IO)                          │
└──────┬──────────────────────┬──────────────────────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐    ┌──────────────────┐
│ orderEvents  │    │socketEventsHandler│  (both use getIO/emitToRoom)
│  ✓ order     │    │  ✓ admin events  │
│  ✓ delivery  │    │  ✓ rider events  │
│  ✓ location  │    │  ✓ legacy order  │
│  ✓ scoped    │    │    event aliases │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       └────────┬────────────┘
                ▼
       ┌──────────────────┐
       │  Frontend socket │
       │  (realtime.ts)   │
       └────────┬─────────┘
                ▼
       ┌──────────────────┐
       │ realtimeManager  │
       │  - typed events  │
       │  - store sync    │
       │  - cleanup       │
       └──────────────────┘
```

## Remaining Risks
1. `socket_events_log` table expected by `socketEventsHandler.js` may not exist — inserts will silently fail (caught by try/catch). Should be verified during Phase 6.
2. Some frontend pages (`orders/page.tsx`, `delivery/active-order/page.tsx`, components like `HomeActiveOrderCard.tsx`) still use `getRealtimeSocket` directly. These should be migrated to `realtimeManager` in a follow-up.
3. The `OrdersPage` in customer app uses a mix of direct socket listeners (legacy events) and the new `customer:order_updated` from `orderEvents.js`. There's still potential for duplicate processing until fully migrated.
