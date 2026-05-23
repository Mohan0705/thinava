# THINAVA Architecture

> Hyperlocal food delivery platform for Tadepalligudem, Andhra Pradesh.
> Next.js 15 App Router frontend + Express.js backend + Supabase PostgreSQL.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        THINAVA Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────┐    ┌──────────────────────────┐    │
│  │   Next.js 15 Frontend    │    │   Express.js Backend     │    │
│  │   (Port 3000)            │◄──►│   (Port 5000)            │    │
│  │                          │    │                          │    │
│  │  - App Router            │    │  - REST API (~146 routes)│    │
│  │  - React 18              │    │  - Auth Middleware       │    │
│  │  - TypeScript            │    │  - Rate Limiting         │    │
│  │  - Tailwind CSS          │    │  - Request Validation    │    │
│  │  - Zustand (state)       │    │  - Socket.IO (real-time) │    │
│  │  - Socket.IO Client      │    │  - File Upload           │    │
│  └──────────┬───────────────┘    └──────────────┬────────────┘    │
│             │                                    │                 │
│             └──────────┬─────────────────────────┘                 │
│                        │                                           │
│              ┌─────────▼──────────┐                                │
│              │   Supabase PG      │                                │
│              │   (Hosted DB)      │                                │
│              │                    │                                │
│              │   ~30 tables       │                                │
│              │   CASCADE deletes  │                                │
│              │   No ENUM types    │                                │
│              └────────────────────┘                                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │               4 Auth Scopes                              │      │
│  │  Customer │ Restaurant │ Delivery Partner │ Admin       │      │
│  └─────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend

### Next.js App Router Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (Inter font, AuthBootstrap, Toaster)
│   ├── page.tsx                # Home page
│   ├── login/                  # Customer login (OTP flow)
│   ├── signup/                 # Customer signup
│   ├── verify-otp/             # OTP verification
│   ├── cart/                   # Shopping cart
│   ├── checkout/               # Checkout + payment
│   ├── orders/                 # Customer order history
│   ├── profile/                # User profile (layout: guarded)
│   ├── addresses/              # Address management
│   ├── favorites/              # Favorite items
│   ├── restaurants/            # Restaurant listing
│   ├── restaurant/             # Restaurant panel (layout: guarded)
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── menu/
│   │   ├── categories/
│   │   └── settings/
│   ├── restaurant-auth/        # Restaurant login/register
│   ├── delivery/               # Delivery partner panel (layout: guarded)
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   └── earnings/
│   ├── rider-auth/             # Rider login/register
│   ├── admin/                  # Admin panel
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── manage-orders/
│   │   ├── restaurants/
│   │   ├── riders/
│   │   ├── customers/
│   │   ├── reviews/
│   │   ├── analytics/
│   │   ├── payments/
│   │   ├── support/
│   │   ├── promotions/
│   │   └── settings/
│   ├── help/                   # Help/support
│   ├── error.tsx               # Error boundary
│   └── global-error.tsx        # Root error boundary
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Card, Badge, etc.)
│   ├── auth/                   # Auth components (OTP input, phone form, route guard)
│   ├── layout/                 # Header, Footer, MobileNav
│   ├── customer/               # Customer components (ReviewModal, InvoicePDF, etc.)
│   ├── delivery/               # Delivery components (LiveMap, SessionLockBanner, etc.)
│   ├── restaurant-panel/       # Restaurant panel components
│   ├── admin/                  # Admin components (Approvals, MetricCard, etc.)
│   └── support/                # Floating WhatsApp/phone support button
├── features/                   # Feature modules
│   ├── auth/                   # Customer auth (api.ts, types, utils, bootstrap)
│   ├── delivery/               # Delivery auth bootstrap
│   ├── restaurant/             # Restaurant auth bootstrap
│   └── admin/                  # Admin auth + API client + permissions + React Query hooks
├── store/                      # Zustand stores
│   ├── authStore.ts            # Customer auth (persisted)
│   ├── deliveryAuthStore.ts    # Delivery auth (persisted)
│   ├── restaurantOwnerAuthStore.ts # Restaurant auth (persisted)
│   ├── cartStore.ts            # Cart (persisted)
│   ├── orderStore.ts           # Orders (in-memory)
│   └── deliveryOrderStore.ts   # Delivery orders (in-memory)
├── lib/                        # Utilities
│   ├── api.ts                  # Core apiRequest<T>() with auto-refresh
│   ├── utils.ts                # cn(), formatPrice(), calculateDeliveryFee(), etc.
│   ├── order-status.ts         # Status constants, normalization, labels
│   ├── realtime.ts             # Socket.IO client
│   ├── google-maps.ts          # Maps SDK dynamic loader
│   ├── auth/                   # Cookies, session management
│   └── i18n/                   # EN/TE translations (Zustand store)
└── types/                      # TypeScript type definitions
    ├── index.ts                # Core types (User, Order, Restaurant, etc.)
    ├── delivery.ts             # Delivery partner types
    └── restaurant-panel.ts     # Restaurant panel types
```

### State Management (Zustand)

| Store | Persisted | Key State | Key Actions |
|-------|-----------|-----------|-------------|
| `authStore` | Yes | `user`, `token`, `stats`, `addresses` | `setAuth`, `logout`, `setAddresses` |
| `deliveryAuthStore` | Yes | `partner`, `token`, `isLoggedIn` | `setSession`, `logout`, `setPartner` |
| `restaurantOwnerAuthStore` | Yes | `owner`, `token` | `setSession`, `logout` |
| `adminAuthStore` | Yes | `admin`, `token` | `setSession`, `logout` |
| `cartStore` | Yes | `items: CartItem[]` | `addItem`, `removeItem`, `clearCart` |
| `orderStore` | No | `orders`, `currentOrder` | `setOrders`, `updateOrderStatus` |
| `deliveryOrderStore` | No | `availableOrders`, `activeOrder` | `setAvailableOrders`, `setActiveOrder` |
| `languageStore` | Yes | `language: 'en' | 'te'` | `setLanguage` |

### API Client Layer

`src/lib/api.ts` provides the central `apiRequest<T>(path, options)` function:

1. **Token Resolution**: Checks explicit token → Zustand store → persisted storage → Supabase fallback
2. **Request**: `fetch` with `Authorization: Bearer <token>` header
3. **401 Handling**: Auto-refreshes token via `POST /{scope}/auth/refresh`
4. **Deduplication**: Parallel 401s for same scope share one refresh request
5. **Session Expiry**: Emits `thinava:session-expired` custom event (rate-limited to 1/2.5s per scope)

### Auth Flow

```
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐
│  Login   │───►│  Store   │───►│   Cookie    │───►│Middleware│
│  Page    │    │ (Zustand)│    │ (syncCookie)│    │ (Server) │
└──────────┘    └──────────┘    └─────────────┘    └────┬─────┘
                                                        │
                                               ┌────────▼────────┐
                                               │ Protected Route  │
                                               │ ✓ Token exists   │
                                               │ ✓ Correct scope  │
                                               └─────────────────┘

┌────────────────┐
│ Bootstrap      │  On page load:
│ Component      │  if (hydrated && token && !user)
│                │    fetch /{scope}/auth/profile
│                │    set in store
└────────────────┘
```

---

## Backend

### Express.js Server Structure

```
server/src/
├── index.js                    # Server entry point, middleware, route mounting
├── database/
│   ├── connection.js           # PostgreSQL Pool (pg driver)
│   ├── migrate.js              # Core schema migration runner
│   ├── migrate-extensions.js   # Extension schema runner
│   ├── schema.sql              # Raw SQL for core tables
│   ├── schema-extensions.sql   # Raw SQL for extended tables
│   ├── ensureRestaurantPanelSchema.js
│   ├── ensureAdminSchema.js
│   ├── ensureCustomerAuthSchema.js
│   ├── ensureRestaurantRegistrationSchema.js
│   ├── ensureDeliveryLogisticsSchema.js
│   ├── ensureFeaturesSchema.js
│   ├── ensureOrderPrivacyAndRatingSchema.js
│   ├── ensureRestaurantMenuSchema.js
│   └── migrations/
│       ├── add-notes-to-order-items.js
│       └── add-order-lifecycle-columns.js
├── routes/
│   ├── auth.js                 # Customer OTP auth (11 endpoints)
│   ├── restaurants.js          # Restaurant CRUD (5 endpoints)
│   ├── menu.js                 # Menu listing (2 endpoints)
│   ├── search.js               # Search (1 endpoint)
│   ├── coupons.js              # Coupon validate/list (2 endpoints)
│   ├── reviews.js              # Review CRUD (3 endpoints)
│   ├── ratings.js              # Rating aggregation (4 endpoints)
│   ├── orders.js               # Order CRUD (4 endpoints)
│   ├── orders-advanced.js      # Advanced order lifecycle (8 endpoints)
│   ├── users.js                # User CRUD (5 endpoints)
│   ├── restaurant-auth.js      # Restaurant auth (6 endpoints)
│   ├── rider-auth.js           # Rider auth (6 endpoints)
│   ├── admin-extended.js       # Admin governance (23 endpoints)
│   └── admin/
│       └── index.js            # Admin dashboard/CRUD (22 endpoints)
├── modules/
│   ├── restaurantPanel/
│   │   ├── constants.js        # Order status enums
│   │   ├── middleware/         # authenticateRestaurantOwner
│   │   └── routes/             # Auth, Orders, Menu, Categories, Settings, Analytics
│   └── delivery/
│       └── routes/             # Auth, Orders, Location, Earnings, Shifts
└── services/
    ├── orderLifecycleService.js # State machine + validation
    └── locationService.js       # Geolocation utilities + ensureUuid()
```

### Route Statistics

| Module | Count | Auth Required |
|--------|-------|---------------|
| Health/Dev | 3 | Mixed |
| Customer Auth | 11 | Mixed |
| Restaurants | 5 | None |
| Menu | 2 | None |
| Search | 1 | None |
| Coupons | 2 | None |
| Reviews | 3 | Mixed |
| Ratings | 4 | Mixed |
| Orders | 4 | Mixed |
| Orders Advanced | 8 | None |
| Users | 5 | None |
| Restaurant Auth | 6 | Mixed |
| Rider Auth | 6 | Mixed |
| Admin | 22 | authenticateAdmin + permissions |
| Admin Extended | 23 | None |
| Restaurant Panel | 19 | authenticateRestaurantOwner |
| Delivery | 22 | authenticateDeliveryPartner |
| **Total** | **~146** | |

### Error Handling Pattern

```javascript
// Global error handler (server/src/index.js)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('API Error:', { status, message, path, method, code, detail, hint, stack });
  res.status(status).json({
    success: false,
    error: message,
    code: err.code,
    ...(dev && { stack: err.stack })  // Stack traces in dev only
  });
});

// Async handler wrapper for routes
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

---

## Core Systems

### Order Lifecycle

```
PLACED ──► ACCEPTED ──► PREPARING ──► READY_FOR_PICKUP ──► OUT_FOR_DELIVERY ──► DELIVERED
   │           │             │                │                     │
   └─────► CANCELLED ◄──────┴────────────────┴─────────────────────┴──── (any state)

State machine enforced by validateOrderTransition() in orderLifecycleService.js
All transitions logged to order_status_history table
Row-level locking (FOR UPDATE OF o) prevents race conditions
```

#### Actors in the lifecycle:
1. **Customer**: Places order → views status → rates after delivery
2. **Restaurant**: Accepts → prepares → marks ready for pickup
3. **Admin**: Can force-ship, force-deliver, cancel, reassign rider
4. **Delivery Partner**: Picks up → delivers → marks delivered

### Restaurant Approval System

```
                    Restaurant Registration
                             │
                             ▼
                    PENDING_APPROVAL
                     /            \
                    ▼              ▼
                 APPROVED       REJECTED
                    │
                    ▼
               ACTIVE (OPEN/CLOSED)
                    │
                    ▼
               SUSPENDED (Admin action)
```

- Registration via `/api/restaurant-auth/register` or admin manual registration
- Admin approves/rejects via `/api/admin-extended/restaurants/:id/approve`
- Suspended restaurants cannot login (403 on auth)
- Approval tracked in `restaurant_approvals` and `restaurant_approval_history`

### Rider Assignment Flow

```
1. Restaurant marks order READY_FOR_PICKUP
2. Order appears in delivery pool (GET /api/delivery/orders)
3. Online rider accepts (POST /api/delivery/orders/accept)
4. Assignment created in delivery_assignments
5. Active delivery created in active_deliveries
6. Rider picks up → updates location → delivers
7. Rating submitted by customer
8. Earnings recorded in delivery_earnings
```

### Real-Time Sync

- Socket.IO client in `src/lib/realtime.ts`
- Supports role-based connections: customer, delivery, admin
- Events: order status updates, rider location, new orders
- Admin dashboard live feed shows real-time order events
- Delivery partner receives assigned order popup

### Rating Aggregation

- **Denormalized**: `restaurants.rating_sum` + `restaurants.rating_count`
- **Computed**: `average = rating_sum / rating_count`
- **Updated on**: New review insertion
- **Tables**: `restaurant_ratings`, `rider_ratings`, `order_reviews` (unified)
- **Distribution**: 1-5 integer scale per dimension (food quality, delivery speed, behavior, overall)
- **Eligibility**: Only delivered orders can be rated; once per order (UNIQUE constraint on `order_id`)

### Payment Handling

- **Methods**: COD (cash on delivery), UPI
- **Status flow**: `pending` → `paid` | `cancelled` | `refunded` | `cod_pending` → `cod_collected`
- **Platform commission**: `commission_percentage` on restaurants (default 22%)
- **Payouts**: Tracked in `payout_transactions` per entity (restaurant/rider)
- **Delivery earnings**: Base pay + distance pay + surge/rain/night bonuses + COD handling fee + tips

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Separate Express backend (not Next.js API routes) | Express provides mature middleware, rate limiting, file upload, WebSocket support; keeps frontend server lightweight |
| Zustand over Redux | Minimal boilerplate, built-in persist middleware, good TypeScript support, small bundle |
| VARCHAR enums instead of PG ENUMs | Flexibility to change enum values without DB migration; downside: no DB-level enforcement |
| CASCADE deletes | Simple cleanup but dangerous; must add defensive null checks in app code |
| 4 separate auth scopes | Each role has distinct API, session, and permission model; shared middleware per scope |
| Cookie + Zustand dual auth | Cookie for middleware SSR guards; Zustand for client-side state |
| No ORM (raw SQL/queries) | Full control over queries; explicit transaction handling; no ORM abstraction leaks |
| Socket.IO for real-time | Mature, well-supported, room-based subscriptions, auto-reconnection |
| Class-based dark mode | CSS variable-based theming; avoids flash with inline detection script |

---

## Security Architecture

- **Password hashing**: bcrypt (10 rounds)
- **JWT**: 7-day expiry for all scopes
- **Rate limiting**: OTP endpoints (10/15min send, 20/15min verify), login attempts (5/15min)
- **CORS**: Configured on Express server
- **Input validation**: `express-validator` on admin routes; manual validation elsewhere
- **SQL injection**: Parameterized queries (pg driver `$1` syntax) — no raw string interpolation
- **Production hardening**: Stack traces excluded in production mode; dev endpoints blocked by NODE_ENV

---

## Development Workflow

```bash
# Start both frontend and backend
npm run dev

# Or separately:
npm run dev:frontend     # Next.js on port 3000
npm run dev:backend      # Express on port 5000

# Build for production
npm run build            # Builds frontend only
# Server runs via: node server/src/index.js
```
