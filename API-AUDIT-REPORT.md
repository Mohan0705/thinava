# THINAVA API Architecture Audit Report

**Date:** 2026-05-23
**Scope:** Full backend (Express) + frontend (Next.js App Router) ~100 source files
**Environment:** Development (localhost:3000 frontend, localhost:5000 backend)

---

## SECTION 1 — ACTIVE APIs

### 1.1 Backend Express Routes (mounted at `http://localhost:5000/api`)

#### Authentication (Customer) — `/api/auth`

| Method | Path | Auth | Rate Limited | Handler |
|--------|------|------|-------------|---------|
| POST | `/auth/send-otp` | No | Yes (OTP send) | `authService.sendOtp` |
| POST | `/auth/verify-otp` | No | Yes (OTP verify) | `authService.verifyOtp` |
| POST | `/auth/refresh` | No | No | `authService.refreshCustomerSession` |
| GET | `/auth/verify` | `authenticateCustomer` | No | `authService.getCustomerProfile` |
| GET | `/auth/profile` | `authenticateCustomer` | No | `authService.getCustomerProfile` |
| PUT | `/auth/profile` | `authenticateCustomer` | No | `authService.updateCustomerProfile` |
| GET | `/auth/addresses` | `authenticateCustomer` | No | `authService.getUserAddresses` |
| POST | `/auth/addresses` | `authenticateCustomer` | No | `authService.upsertAddress` |
| PUT | `/auth/addresses/:addressId` | `authenticateCustomer` | No | `authService.upsertAddress` |
| DELETE | `/auth/addresses/:addressId` | `authenticateCustomer` | No | `authService.deleteAddress` |
| POST | `/auth/logout` | `authenticateCustomer` | No | inline (confirms) |
| POST | `/auth/favorites/:restaurantId` | `authenticateCustomer` | No | Favorites CRUD |
| DELETE | `/auth/favorites/:restaurantId` | `authenticateCustomer` | No | Favorites CRUD |
| GET | `/auth/favorites` | `authenticateCustomer` | No | Favorites CRUD |

#### Restaurants (Public) — `/api/restaurants`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/restaurants` | No | Filter by `featured`, `cuisine` |
| GET | `/restaurants/:id` | No | Full restaurant detail |
| POST | `/restaurants` | No | Create restaurant (no auth!) |
| PUT | `/restaurants/:id` | No | Update restaurant (no auth!) |
| DELETE | `/restaurants/:id` | No | Delete restaurant (no auth!) |

#### Menu (Public) — `/api/menu`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/menu/restaurant/:restaurantId` | No | Full menu: categories + items + variants + addons |
| GET | `/menu/:id` | No | Single menu item |

#### Orders — `/api/orders`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/orders/user/:userId` | `authenticateCustomer` | User's orders |
| GET | `/orders/:id` | No | Order by ID (no auth!) |
| POST | `/orders` | No | Create order (no auth!) |
| PUT | `/orders/:id/status` | No | Update order status (no auth!) |

#### Orders (Advanced) — `/api/orders-advanced`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/orders-advanced/create` | No | Create order + realtime events |
| POST | `/orders-advanced/:id/assign-rider` | No | Assign rider + active delivery session |
| POST | `/orders-advanced/:id/reject` | No | Reject (restaurant) + release rider |
| POST | `/orders-advanced/:id/accept` | No | Accept/confirm order |
| POST | `/orders-advanced/:id/ready-for-pickup` | No | Mark ready for pickup |
| POST | `/orders-advanced/:id/picked-up` | No | Mark picked up |
| POST | `/orders-advanced/:id/delivered` | No | Mark delivered + close session |
| GET | `/orders-advanced/rider/:riderId/active` | No | Get active order for rider |

#### Users — `/api/users`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/users/:userId/addresses` | No | List addresses |
| POST | `/users/:userId/addresses` | No | Create address |
| PUT | `/users/:userId/addresses/:addressId` | No | Update address |
| DELETE | `/users/:userId/addresses/:addressId` | No | Delete address |
| PUT | `/users/:userId` | No | Update user (name/email) |

#### Reviews — `/api/reviews`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/reviews` | `authenticateCustomer` | Submit review + order validation |
| GET | `/reviews/restaurant/:restaurantId` | No | Get restaurant reviews |
| GET | `/reviews/rider/:riderId` | No | Get rider reviews |

#### Ratings — `/api/ratings`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/ratings/eligibility` | `authenticateCustomer` | Orders eligible for rating |
| POST | `/ratings/submit` | `authenticateCustomer` | Submit rating (aggregated) |
| GET | `/ratings/restaurant/:restaurantId` | No | Restaurant review analytics |
| GET | `/ratings/rider/:riderId` | No | Rider review analytics |
| GET | `/ratings/analytics/restaurant/:restaurantId` | No | Restaurant analytics |
| GET | `/ratings/analytics/rider/:riderId` | No | Rider analytics |
| GET | `/ratings/analytics/admin` | No | Admin analytics |
| GET | `/ratings/food-items/:restaurantId` | No | Food item ratings |

#### Coupons — `/api/coupons`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/coupons/active` | No | Active coupons |
| POST | `/coupons/validate` | No | Validate coupon |

#### Search — `/api/search`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/search` | No | q param, veg/maxPrice filters |

#### Restaurant Auth (Legacy) — `/api/restaurant-auth`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/restaurant-auth/register` | No | Register (validates, creates in transaction) |
| POST | `/restaurant-auth/login` | No | Login with email/password |
| GET | `/restaurant-auth/profile` | `authenticateRestaurant` | Profile |
| POST | `/restaurant-auth/status/update` | `authenticateRestaurant` | Update status + realtime |
| GET | `/restaurant-auth/status/:restaurantId` | No | Public status |
| POST | `/restaurant-auth/logout` | `authenticateRestaurant` | Logout |

#### Rider Auth (Legacy) — `/api/rider-auth`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/rider-auth/register` | No | Register |
| POST | `/rider-auth/login` | No | Login |
| GET | `/rider-auth/profile` | `authenticateRider` | Profile |
| POST | `/rider-auth/online-status` | `authenticateRider` | Set online/offline |
| POST | `/rider-auth/location` | `authenticateRider` | Update location |
| POST | `/rider-auth/logout` | `authenticateRider` | Logout |

#### Restaurant Panel (Module) — `/api/restaurant`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/restaurant/auth/login` | No | Login with validators |
| POST | `/restaurant/auth/refresh` | No | Refresh session |
| GET | `/restaurant/auth/me` | `authenticateRestaurantOwner` | Profile |
| GET | `/restaurant/orders/summary` | `authenticateRestaurantOwner` | Dashboard summary |
| GET | `/restaurant/orders` | `authenticateRestaurantOwner` | List orders |
| PATCH | `/restaurant/orders/:orderId/status` | `authenticateRestaurantOwner` | Update status |
| GET | `/restaurant/menu` | `authenticateRestaurantOwner` | List menu |
| POST | `/restaurant/menu` | `authenticateRestaurantOwner` | Create item |
| PUT | `/restaurant/menu/:menuItemId` | `authenticateRestaurantOwner` | Update item |
| PATCH | `/restaurant/menu/:menuItemId/stock` | `authenticateRestaurantOwner` | Toggle stock |
| DELETE | `/restaurant/menu/:menuItemId` | `authenticateRestaurantOwner` | Delete item |
| POST | `/restaurant/menu/:menuItemId/variant` | `authenticateRestaurantOwner` | Create variant |
| PUT | `/restaurant/menu/:menuItemId/variant/:variantId` | `authenticateRestaurantOwner` | Update variant |
| DELETE | `/restaurant/menu/:menuItemId/variant/:variantId` | `authenticateRestaurantOwner` | Delete variant |
| POST | `/restaurant/menu/:menuItemId/addon` | `authenticateRestaurantOwner` | Create addon |
| PUT | `/restaurant/menu/:menuItemId/addon/:addonId` | `authenticateRestaurantOwner` | Update addon |
| DELETE | `/restaurant/menu/:menuItemId/addon/:addonId` | `authenticateRestaurantOwner` | Delete addon |
| GET | `/restaurant/categories` | `authenticateRestaurantOwner` | List categories |
| POST | `/restaurant/categories` | `authenticateRestaurantOwner` | Create category |
| PUT | `/restaurant/categories/reorder` | `authenticateRestaurantOwner` | Reorder |
| PUT | `/restaurant/categories/:categoryId` | `authenticateRestaurantOwner` | Update category |
| DELETE | `/restaurant/categories/:categoryId` | `authenticateRestaurantOwner` | Delete category |
| GET | `/restaurant/settings` | `authenticateRestaurantOwner` | Get settings |
| PUT | `/restaurant/settings` | `authenticateRestaurantOwner` | Update settings |
| GET | `/restaurant/analytics` | `authenticateRestaurantOwner` | Get analytics (days query param) |

#### Delivery Rider (Module) — `/api/delivery`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/delivery/auth/register` | No | Register |
| POST | `/delivery/auth/login` | No | Login |
| POST | `/delivery/auth/refresh` | No | Refresh |
| GET | `/delivery/auth/profile` | `authenticateDeliveryPartner` | Profile |
| POST | `/delivery/auth/online-status` | `authenticateDeliveryPartner` | Online/offline + dispatch |
| POST | `/delivery/auth/status` | `authenticateDeliveryPartner` | Update status |
| GET | `/delivery/orders` | `authenticateDeliveryPartner` | Available orders |
| POST | `/delivery/orders/accept` | `authenticateDeliveryPartner` | Accept order |
| POST | `/delivery/orders/confirm-assignment` | `authenticateDeliveryPartner` | Confirm assignment |
| POST | `/delivery/orders/reject` | `authenticateDeliveryPartner` | Reject order |
| GET | `/delivery/orders/active` | `authenticateDeliveryPartner` | Active order |
| POST | `/delivery/orders/status` | `authenticateDeliveryPartner` | Update delivery status |
| POST | `/delivery/location` | `authenticateDeliveryPartner` | Update location |
| GET | `/delivery/location` | `authenticateDeliveryPartner` | Get latest location |
| GET | `/delivery/location/history` | `authenticateDeliveryPartner` | Location history |
| GET | `/delivery/earnings/today` | `authenticateDeliveryPartner` | Today's earnings |
| GET | `/delivery/earnings/week` | `authenticateDeliveryPartner` | Weekly earnings |
| GET | `/delivery/earnings/month` | `authenticateDeliveryPartner` | Monthly earnings |
| GET | `/delivery/earnings/history` | `authenticateDeliveryPartner` | Earnings history |
| GET | `/delivery/shifts` | `authenticateDeliveryPartner` | List shifts |
| POST | `/delivery/shifts/book` | `authenticateDeliveryPartner` | Book shift |
| GET | `/delivery/wallet` | `authenticateDeliveryPartner` | Get wallet |
| GET | `/delivery/wallet/floating-cash` | `authenticateDeliveryPartner` | Floating cash status |
| POST | `/delivery/wallet/request-pickup` | `authenticateDeliveryPartner` | Request cash pickup |
| GET | `/delivery/wallet/pickup-requests` | `authenticateDeliveryPartner` | Pickup requests |
| GET | `/delivery/support` | `authenticateDeliveryPartner` | Support info |

#### Admin — `/api/admin`

| Method | Path | Auth | Rate Limited |
|--------|------|------|-------------|
| POST | `/admin/auth/login` | No | Yes (10/15min) |
| POST | `/admin/auth/refresh` | No | No |
| GET | `/admin/auth/profile` | `authenticateAdmin` | No |
| GET | `/admin/dashboard` | `authenticateAdmin` + `DASHBOARD_VIEW` | No |
| GET | `/admin/orders` | `authenticateAdmin` + `ORDERS_VIEW` | No |
| PATCH | `/admin/orders/:orderId/status` | `authenticateAdmin` + `ORDERS_MANAGE` | No |
| POST | `/admin/orders/:orderId/cancel` | `authenticateAdmin` + `ORDERS_MANAGE` | No |
| POST | `/admin/orders/:orderId/mark-delivered` | `authenticateAdmin` + `ORDERS_MANAGE` | No |
| POST | `/admin/orders/:orderId/reassign-rider` | `authenticateAdmin` + `ORDERS_MANAGE,DELIVERY_MANAGE` | No |
| GET | `/admin/restaurants` | `authenticateAdmin` + `RESTAURANTS_VIEW` | No |
| PATCH | `/admin/restaurants/:restaurantId` | `authenticateAdmin` + `RESTAURANTS_MANAGE` | No |
| GET | `/admin/delivery-partners` | `authenticateAdmin` + `DELIVERY_VIEW` | No |
| PATCH | `/admin/delivery-partners/:partnerId` | `authenticateAdmin` + `DELIVERY_MANAGE` | No |
| GET | `/admin/customers` | `authenticateAdmin` + `CUSTOMERS_VIEW` | No |
| PATCH | `/admin/customers/:customerId` | `authenticateAdmin` + `CUSTOMERS_MANAGE` | No |
| GET | `/admin/analytics` | `authenticateAdmin` + `ANALYTICS_VIEW` | No |
| GET | `/admin/payments` | `authenticateAdmin` + `PAYMENTS_VIEW` | No |
| GET | `/admin/support` | `authenticateAdmin` + `SUPPORT_VIEW` | No |
| PATCH | `/admin/support/:ticketId` | `authenticateAdmin` + `SUPPORT_MANAGE` | No |
| GET | `/admin/promotions` | `authenticateAdmin` + `PROMOTIONS_VIEW` | No |
| POST | `/admin/promotions/coupons` | `authenticateAdmin` + `PROMOTIONS_MANAGE` | No |
| GET | `/admin/settings` | `authenticateAdmin` + `SETTINGS_VIEW` | No |
| PUT | `/admin/settings` | `authenticateAdmin` + `SETTINGS_MANAGE` | No |
| GET | `/admin/live-map` | `authenticateAdmin` + `MAP_VIEW` | No |

#### Admin Extended — `/api/admin-extended`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin-extended/restaurants/pending` | No | Pending approvals |
| GET | `/admin-extended/restaurants/approvals` | No | All approvals |
| POST | `/admin-extended/restaurants/:id/approve` | No | Approve + realtime |
| POST | `/admin-extended/restaurants/:id/reject` | No | Reject + realtime |
| GET | `/admin-extended/riders/pending` | No | Pending riders |
| POST | `/admin-extended/riders/:id/approve` | No | Approve + realtime |
| POST | `/admin-extended/riders/:id/reject` | No | Reject + realtime |
| POST | `/admin-extended/restaurants/register-manual` | No | Register + auto-approve |
| POST | `/admin-extended/riders/register-manual` | No | Register + auto-approve |
| GET | `/admin-extended/restaurants` | No | List all |
| PUT | `/admin-extended/restaurants/:id/status` | No | Update status |
| DELETE | `/admin-extended/restaurants/:id` | No | Delete |
| GET | `/admin-extended/riders` | No | List all |
| PUT | `/admin-extended/riders/:id/status` | No | Update status |
| DELETE | `/admin-extended/riders/:id` | No | Delete |
| GET | `/admin-extended/restaurants/:id/menu` | No | Full menu |
| POST | `/admin-extended/restaurants/:id/category` | No | Create category |
| PUT | `/admin-extended/restaurants/:id/category/:categoryId` | No | Update category |
| DELETE | `/admin-extended/restaurants/:id/category/:categoryId` | No | Delete category |
| PUT | `/admin-extended/restaurants/:id/categories/reorder` | No | Reorder |
| POST | `/admin-extended/restaurants/:id/item` | No | Create item |
| PUT | `/admin-extended/restaurants/:id/item/:itemId` | No | Update item |
| PATCH | `/admin-extended/restaurants/:id/item/:itemId/stock` | No | Toggle stock |
| DELETE | `/admin-extended/restaurants/:id/item/:itemId` | No | Delete item |
| POST | `/admin-extended/restaurants/:id/item/:itemId/variant` | No | Create variant |
| PUT | `/admin-extended/restaurants/:id/item/:itemId/variant/:variantId` | No | Update variant |
| DELETE | `/admin-extended/restaurants/:id/item/:itemId/variant/:variantId` | No | Delete variant |
| POST | `/admin-extended/restaurants/:id/item/:itemId/addon` | No | Create addon |
| PUT | `/admin-extended/restaurants/:id/item/:itemId/addon/:addonId` | No | Update addon |
| DELETE | `/admin-extended/restaurants/:id/item/:itemId/addon/:addonId` | No | Delete addon |

#### Dev / Health — `/api/dev` and `/api/health`

| Method | Path | Production |
|--------|------|------------|
| GET | `/api/health` | Yes |
| GET | `/api/dev/delivery-count` | Blocked in prod |
| POST | `/api/dev/admin-unlock` | Blocked in prod |
| POST | `/api/dev/admin-verify` | Blocked in prod |
| GET | `/api/dev/test-orders` | Blocked in prod |

---

### 1.2 Frontend API Client (apiRequest wrapper)

The frontend uses a unified `apiRequest<T>(path, options?)` function that:
- Prepends `API_BASE_URL` (http://localhost:5000/api) to all paths
- Automatically injects `Authorization: Bearer <token>` from 4 auth stores
- Handles 401 with automatic token refresh via scope-specific refresh endpoints
- Retries once on network error with jittered backoff

**Scope-specific refresh endpoints:**
| Scope | Refresh Path |
|-------|-------------|
| customer | `/auth/refresh` |
| delivery | `/delivery/auth/refresh` |
| restaurant | `/restaurant/auth/refresh` |
| admin | `/admin/auth/refresh` |

### 1.3 Frontend Page Routes (52 pages)

All listed in full from `/` to `/admin/settings`. Every page makes client-side API calls to the backend — no Server Side Rendering (SSR), no Server Actions.

---

## SECTION 2 — BROKEN APIs

### CRITICAL: Relative URL Calls (Will Always Fail in Production)

These use `axios.get/post()` or `fetch()` with relative URLs → go to Next.js origin (port 3000) → no API routes → return 404 HTML.

| File | Line(s) | Code | Impact |
|------|---------|------|--------|
| `src/app/rider-auth/page.tsx` | 40 | `axios.post('/api/rider-auth/login', ...)` | Rider login always fails |
| `src/app/rider-auth/page.tsx` | ~300 | `axios.post('/api/rider-auth/register', ...)` | Rider registration always fails |
| `src/components/admin/AdminApprovals.tsx` | 50 | `axios.get('/api/admin-extended/restaurants/pending')` | Admin approvals never load |
| `src/components/admin/AdminApprovals.tsx` | 61 | `axios.post('/api/admin-extended/restaurants/${id}/approve')` | Approve action fails |
| `src/components/admin/AdminApprovals.tsx` | 76 | `axios.post('/api/admin-extended/restaurants/${id}/reject')` | Reject action fails |
| `src/components/admin/AdminApprovals.tsx` | ~110 | `axios.get('/api/admin-extended/riders/pending')` | Pending riders not loading |
| `src/components/admin/AdminApprovals.tsx` | ~120 | `axios.post('/api/admin-extended/riders/${id}/approve')` | Rider approve fails |
| `src/components/admin/AdminApprovals.tsx` | ~130 | `axios.post('/api/admin-extended/riders/${id}/reject')` | Rider reject fails |
| `src/components/admin/AdminApprovals.tsx` | ~200 | `axios.get('/api/admin-extended/menu/categories')` | Menu categories not loading |
| `src/components/admin/AdminApprovals.tsx` | ~210 | `axios.get('/api/admin-extended/menu/items/${id}')` | Menu items not loading |
| `src/components/admin/AdminApprovals.tsx` | ~220 | `axios.post('/api/admin-extended/menu/category/create')` | Category create fails |
| `src/components/admin/AdminApprovals.tsx` | ~230 | `axios.post('/api/admin-extended/menu/item/create')` | Item create fails |

**Root cause:** These use relative URLs (`/api/rider-auth/...` instead of full URL `http://localhost:5000/api/rider-auth/...`). No Next.js rewrites exist in `next.config.js`.

### CRITICAL: Missing API Endpoints (Backend Missing Routes)

Frontend calls these but backend has NO matching route:

| Frontend Call | Expected Backend Route | Backend Status |
|---------------|----------------------|----------------|
| `PUT /admin/customers/:id` | `PATCH /admin/customers/:customerId` | **Method mismatch** (PUT vs PATCH) |
| `DELETE /admin/restaurants/:id` | `DELETE /admin-extended/restaurants/:id` | Different base path |
| `GET /admin/restaurants` (from adminApi `getRestaurants`) | n/a mapped to `/admin-extended/restaurants` | Works (correct mapping) |
| `PUT /admin-extended/restaurants/:id/status` | Backend expects `PUT` at same path | **Works** |
| `GET /delivery/orders/active` | Backend: `GET /delivery/orders/active` | **Works** |
| `GET /delivery/orders` (available orders) | Backend: `GET /delivery/orders` | **Works** |
| `POST /delivery/orders/accept` (body: `{order_id}`) | Backend: `POST /delivery/orders/accept` | **Works** |
| `POST /delivery/orders/status` (body: `{order_id, status}`) | Backend: `POST /delivery/orders/status` | **Works** |
| `POST /delivery/location` | Backend: `POST /delivery/location` | **Works** |
| `GET /restaurant/analytics` | Backend: `GET /restaurant/analytics` | **Works** |

**Conclusion:** All `adminApi` calls through `apiRequest()` are correctly routed and match backend. The broken APIs are ONLY the **legacy axios calls** using relative URLs in `rider-auth/page.tsx` and `AdminApprovals.tsx`.

### HIGH: Missing Auth on Critical Routes

These routes have **NO authentication middleware** despite performing sensitive operations:

| Route | Method | Operation | Risk |
|-------|--------|-----------|------|
| `/api/restaurants` | POST | Create restaurant | Anyone can create |
| `/api/restaurants/:id` | PUT | Update restaurant | Anyone can modify |
| `/api/restaurants/:id` | DELETE | Delete restaurant | Anyone can delete |
| `/api/orders` | POST | Create order | Anyone can place |
| `/api/orders/:id/status` | PUT | Update order status | Anyone can change status |
| `/api/orders-advanced/*` | ALL | Full order lifecycle | No auth on any advanced route |
| `/api/admin-extended/*` | ALL | Full admin CRUD | **ZERO authentication** on entire admin-extended module |
| `/api/users/*` | ALL | User data CRUD | No auth on user operations |

### MEDIUM: Frontend Redirects to Wrong Routes

| File | Code | Issue |
|------|------|-------|
| `src/app/rider-auth/page.tsx:47` | `router.push('/rider/dashboard')` | Should be `/delivery/dashboard` |
| `src/app/restaurant-auth/page.tsx:222` | `fetch(.../restaurant-auth/register)` | Uses full URL through API_BASE_URL — **actually works** |

---

## SECTION 3 — UNUSED APIs

| Route | Method | Reason Unused |
|-------|--------|---------------|
| `GET /api/auth/verify` | GET | No frontend calls to `/auth/verify` |
| `GET /api/reviews/rider/:riderId` | GET | Never called from frontend |
| `GET /api/ratings/analytics/admin` | GET | No frontend usage |
| `GET /api/ratings/food-items/:restaurantId` | GET | No frontend usage |
| `GET /api/restaurant-auth/profile` | GET | Frontend uses `/restaurant/auth/me` instead |
| `POST /api/restaurant-auth/status/update` | POST | Frontend uses restaurant panel `/settings` |
| `GET /api/rider-auth/profile` | GET | Frontend uses delivery module `/auth/profile` |
| `POST /api/riders/register-manual` | POST | No frontend call |
| `POST /api/admin/dev/*` | ALL | Dev-only, not used in production |

---

## SECTION 4 — SECURITY RISKS

### CRITICAL
1. **No authentication on `/api/admin-extended/*`** — Full admin CRUD (restaurant deletion, rider management, menu management) is publicly accessible with zero authentication.
2. **No authentication on `/api/users/*`** — User addresses and profiles can be read/modified by anyone.
3. **No authentication on `/api/orders-advanced/*`** — Full order lifecycle (create, assign rider, mark delivered) is publicly accessible.
4. **No authentication on `/api/restaurants` POST/PUT/DELETE** — Restaurant data can be manipulated by anyone.

### HIGH
5. **JWT secret fallback is hardcoded** — `'thinava-admin-secret'` in `auth.js`, visible in source.
6. **No rate limiting on any admin-extended routes** — Brute force on admin operations.
7. **No input sanitization on many routes** — Direct SQL queries with user input on many inline handlers.
8. **CORS allows `http://localhost:3000`** — No production origin restricted.
9. **Password in DATABASE_URL** — Supabase connection string contains password in plain text.

### MEDIUM
10. **OTP is static in development** — `STATIC_MOCK_OTP` constant allows bypass.
11. **No refresh token rotation** — Old tokens remain valid.
12. **Token stored in localStorage** (rider-auth page:44) — XSS vulnerable.

---

## SECTION 5 — ENVIRONMENT VARIABLES

### Required Variables

| Variable | File | Set? | Used In |
|----------|------|------|---------|
| `DATABASE_URL` | `server/.env` | ✅ | Backend DB connection |
| `JWT_SECRET` | `server/.env` | ✅ | JWT signing |
| `PORT` | `server/.env` | ✅ (5000) | Server listen |
| `NODE_ENV` | `server/.env` | ✅ | Dev/prod mode |
| `NEXT_PUBLIC_API_URL` | `.env`, `.env.local` | ✅ | Frontend API base |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `.env.local` | ✅ | Google Maps |
| `SUPER_ADMIN_EMAIL` | `.env.admin` | ✅ | Admin seeding |
| `SUPER_ADMIN_PASSWORD` | `.env.admin` | ✅ | Admin seeding |
| `OPS_ADMIN_EMAIL` | `.env.admin` | ✅ | Admin seeding |
| `OPS_ADMIN_PASSWORD` | `.env.admin` | ✅ | Admin seeding |
| `FINANCE_ADMIN_EMAIL` | `.env.admin` | ✅ | Admin seeding |
| `FINANCE_ADMIN_PASSWORD` | `.env.admin` | ✅ | Admin seeding |
| `SUPPORT_ADMIN_EMAIL` | `.env.admin` | ✅ | Admin seeding |
| `SUPPORT_ADMIN_PASSWORD` | `.env.admin` | ✅ | Admin seeding |

### Missing Variables

| Variable | Needed For | Priority |
|----------|-----------|----------|
| `ADMIN_JWT_SECRET` | Separate admin JWT secret (currently falls back to `JWT_SECRET`) | HIGH |
| `RESTAURANT_JWT_SECRET` | Separate restaurant JWT secret | MEDIUM |
| `DELIVERY_JWT_SECRET` | Separate delivery JWT secret | MEDIUM |
| `NEXT_PUBLIC_SOCKET_URL` | Realtime socket URL (falls back to API_BASE_URL) | LOW |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | MEDIUM |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | MEDIUM |

### Duplicate/Conflicting

- `JWT_SECRET` is shared across all auth scopes (customer, delivery, restaurant, admin). This means a customer token can be used to authenticate as admin.
- `NEXT_PUBLIC_API_URL` = `http://localhost:5000/api` in all envs — will need to change to production URL for deploy.

---

## SECTION 6 — DATABASE RELATIONS

```
users (id, name, phone, email, created_at, is_blocked, fraud_score)
├── addresses (id, user_id, label, address, landmark, lat, lng, is_default)
├── favorites (id, user_id, restaurant_id)
├── orders (id, user_id, restaurant_id, delivery_partner_id, status, delivery_status, 
│           total, subtotal, delivery_fee, tax, payment_method, area, 
│           platform_commission_amount, payout_status, admin_flagged, 
│           cancellation_reason, cancelled_at, delivered_at, picked_up_at, 
│           delivery_assigned_at, created_at, updated_at)
│   └── order_items (id, order_id, menu_item_id, quantity, price, notes)
│
├── reviews (id, user_id, restaurant_id, rider_id, rating, comment, created_at)
├── ratings (id, order_id, user_id, restaurant_rating, rider_rating, 
│           food_quality, delivery_speed, overall, comment, created_at)
│
├── support_tickets (id, customer_id, order_id, assigned_admin_id, category, 
│                   subject, description, status, priority, resolution_notes, 
│                   refund_amount, created_at, updated_at)

restaurants (id, name, description, cuisines, rating, featured, is_open, status,
            approval_status, commission_percentage, is_suspended, complaints_count,
            lat, lng, zone_name, phone, category, veg_non_veg)
├── restaurant_details (id, restaurant_id, address, city, state, pincode, 
│                      opening_time, closing_time, delivery_radius, 
│                      minimum_order, delivery_time, price_for_one, offer, image)
├── restaurant_approvals (id, restaurant_id, status, created_at)
├── menu_categories (id, restaurant_id, name, description, display_order)
├── menu_items (id, restaurant_id, category_id, name, description, price, 
│              offer_price, image, is_veg, is_bestseller, in_stock, 
│              preparation_time, spice_level, calories, is_recommended, display_order)
│   ├── restaurant_item_variants (id, menu_item_id, name, price)
│   └── restaurant_item_addons (id, menu_item_id, name, price)
├── restaurant_users (id, restaurant_id, full_name, email, phone, password_hash, role)
└── restaurant_coupons (id, restaurant_id, code, ...)

delivery_partners (id, full_name, phone, email, password_hash, vehicle_type, 
                  vehicle_number, is_online, is_active, rating, total_deliveries,
                  current_status, approval_status, document_status, 
                  vehicle_verification_status, is_suspended, force_offline,
                  earnings_balance, last_seen_at, home_zone, lat, lng)
├── rider_details (id, rider_id, aadhar_number, driving_license, zone)
├── delivery_assignments (id, order_id, rider_id, status, assigned_at, 
│                        confirmed_at, cancelled_at, delivered_at)
├── active_deliveries (id, order_id, rider_id, status, assigned_at, 
│                     cancelled_at, delivered_at, delivery_assigned_at)
├── delivery_tracking (id, order_id, rider_id, lat, lng, timestamp, 
│                     cancelled_at, delivered_at)
├── delivery_status_logs (id, order_id, rider_id, status, created_at,
│                        cancelled_at, delivered_at)
├── rider_locations (id, rider_id, latitude, longitude, accuracy, timestamp)
├── rider_earnings (id, rider_id, amount, type, order_id, date, description)
├── rider_wallets (id, rider_id, balance, floating_cash, updated_at)
├── rider_cash_pickup_requests (id, rider_id, amount, status, notes, created_at)
├── shifts (id, slot_label, zone_name, starts_at, ends_at, demand_level, 
│          incentive_amount, max_riders, created_at)
├── shift_bookings (id, shift_id, rider_id, booked_at)
└── rider_ratings (id, rider_id, rating, review, order_id, created_at)

admin_users (id, email, password_hash, full_name, role, permissions (jsonb),
            is_active, last_login_at, failed_login_attempts, lockout_until,
            created_at, updated_at)
├── admin_activity_logs (id, admin_user_id, action, entity_type, entity_id,
                        description, metadata, ip_address, user_agent, created_at)

coupon_codes (id, code, title, description, discount_type, discount_value,
             minimum_order_amount, max_discount_amount, usage_limit, used_count,
             starts_at, ends_at, is_active, target_audience, 
             featured_restaurant_id, banner_image, created_at, updated_at)

platform_settings (id, setting_key, setting_value (jsonb), description, category,
                  updated_by, created_at, updated_at)

payout_transactions (id, entity_type, entity_id, order_id, amount, 
                    commission_amount, settlement_amount, status,
                    payout_reference, due_date, settled_at, notes, created_at)
```

---

## SECTION 7 — REQUIRED FIXES BEFORE DEPLOYMENT

### P0 — Must Fix (Will Cause Production Failure)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 1 | Relative URL axios calls → Next.js origin | `rider-auth/page.tsx`, `AdminApprovals.tsx` | Replace with `apiRequest()` using full API_BASE_URL path |
| 2 | No auth on `/api/admin-extended/*` | `server/src/routes/admin-extended.js` | Add `authenticateAdmin` middleware to all routes |
| 3 | No auth on `/api/users/*` | `server/src/routes/users.js` | Add `authenticateCustomer` middleware |
| 4 | No auth on `/api/orders-advanced/*` | `server/src/routes/orders-advanced.js` | Add appropriate auth middleware |
| 5 | Rider auth page redirects to `/rider/dashboard` | `rider-auth/page.tsx:47` | Change to `/delivery/dashboard` |
| 6 | `NEXT_PUBLIC_API_URL` hardcoded to localhost | `.env`, `.env.local` | Set to production URL in deployment |

### P1 — High Priority

| # | Issue | Fix |
|---|-------|-----|
| 7 | Shared JWT secret across all scopes | Create `ADMIN_JWT_SECRET`, `RESTAURANT_JWT_SECRET`, `DELIVERY_JWT_SECRET` env vars |
| 8 | Restaurant CRUD routes have no auth | Add `authenticateRestaurantOwner` or admin middleware |
| 9 | Order creation/status routes have no auth | Add `authenticateCustomer` or delivery middleware |
| 10 | CORS allows `localhost:3000` only | Update for production frontend URL |
| 11 | No addon/variant management routes in restaurant panel frontend | Frontend has functions but pages may not use them fully |

### P2 — Medium Priority

| # | Issue | Fix |
|---|-------|-----|
| 12 | `/api/admin-extended/restaurants/pending` duplicates `/api/admin-extended/restaurants/approvals` | Consolidate to single endpoint |
| 13 | Duplicate restaurant listing: `/api/admin/restaurants` and `/api/admin-extended/restaurants` | Remove one |
| 14 | No password strength validation on registration | Add validation in route handlers |
| 15 | Static OTP in dev mode | Remove or guard with NODE_ENV check |
| 16 | Token stored in localStorage for rider | Move to httpOnly cookie |

---

## SECTION 8 — PRODUCTION DEPLOYMENT READINESS

### Authentication Flow
```
Frontend                          Backend
──────────────────────────────────────────────────────
POST /api/admin/auth/login  →    loginAdmin()
     email + password             bcrypt.compare()
                                  check lockout
                                  generate JWT (12h expiry)
     ← { token, admin }          return sanitized admin

All subsequent requests:
Authorization: Bearer <token>  → authenticateAdmin()
                                  jwt.verify()
                                  hydrateAdminUser() from DB
                                  attach req.adminUser
                                  → authorizeAdmin(perm) check
```

**Same pattern for:** Customer (OTP-based), Delivery Rider (phone+password), Restaurant Owner (email+password)

### Order Lifecycle Flow
```
PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED
                                                                    → CANCELLED (any point)
```

**Actors involved:**
1. Customer: Places order (POST `/api/orders` or `/api/orders-advanced/create`)
2. Restaurant: Accepts → Prepares → Ready (PATCH `/api/restaurant/orders/:id/status`)
3. Rider: Accepts → Picks up → Delivers (POST `/api/delivery/orders/status`)
4. Admin: Can override at any point (PATCH `/api/admin/orders/:id/status`)

**Realtime events emitted at every status change** via Socket.IO.

### Review Lifecycle Flow
```
Order DELIVERED → Customer sees rating prompt
                → GET /api/ratings/eligibility (lists delived orders)
                → POST /api/ratings/submit (restaurant, rider, food, delivery ratings)
                → reviewAggregationService.aggregateRating() updates:
                  - restaurant average rating
                  - rider average rating
                  - food item ratings
```

### Rider Assignment Flow
```
1. Order placed (no rider) - status: PENDING
2. dispatchPendingOrders() runs periodically
3. Rider sees order in GET /api/delivery/orders (available orders)
4. Rider POST /api/delivery/orders/accept { order_id }
5. System assigns rider, creates delivery_assignment + active_delivery
6. Rider POST /api/delivery/orders/confirm-assignment { order_id }
7. Realtime event emitted to all stakeholders
```

### Production Landing Page Path
The app has NO landing page that explains the product — `/` goes directly to a customer-facing restaurant listing page (`HomePage.tsx`). This is not suitable for production where a marketing landing page is expected.

### Build Status
- TypeScript compilation: ✅ PASSES (zero errors)
- Static page generation: ✅ 52/52 pages generated
- PWA: ✅ Service worker registered
- Vercel deployment: ⚠️ Requires fixing P0 issues first

---

## API DEPENDENCY FLOW DIAGRAM

```
┌─────────────┐     ┌──────────────────────────────────────┐
│  Next.js     │     │  Express Backend (port 5000)          │
│  (port 3000) │     │                                      │
│              │     │  ┌──────────────────────────────────┐ │
│  Pages ──────┼─────┼─▶│  /api/* Routes                  │ │
│  (52 pages)  │     │  │  ├── auth/   (customer auth)    │ │
│              │     │  │  ├── restaurants/               │ │
│  apiRequest  │     │  │  ├── menu/                      │ │
│  ────────────┼─────┼─▶│  ├── orders/   + orders-adv/   │ │
│  (lib/api.ts)│     │  │  ├── users/                     │ │
│              │     │  │  ├── reviews/   + ratings/      │ │
│  Realtime ───┼─────┼─▶│  ├── coupons/                   │ │
│  (Socket.IO) │     │  │  ├── search/                    │ │
│              │     │  │  ├── restaurant/  (panel)       │ │
│  Legacy      │     │  │  ├── restaurant-auth/ (legacy)  │ │
│  Axios ──────┼─❌──┼─▶│  ├── rider-auth/   (legacy)    │ │
│  (relative)  │     │  │  ├── delivery/    (module)      │ │
│              │     │  │  ├── admin/                     │ │
│              │     │  │  ├── admin-extended/ ❌ NO AUTH │ │
│              │     │  │  └── health/                    │ │
│              │     │  └──────────────────────────────────┘ │
│              │     │                                      │
│              │     │  Middleware:                          │
│              │     │  helmet() · cors() · ratelimit()      │
│              │     │  authenticateCustomer/Admin/Rider     │
│              │     │  authorizeAdmin(permissions)          │
│              │     │                                      │
│              │     │  Database: Supabase PostgreSQL        │
│              │     │  Realtime: Socket.IO                   │
│              │     └──────────────────────────────────────┘ │
└─────────────┘                                              │
```

## PRODUCTION DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Fix P0 issues (relative URLs → use apiRequest)
- [ ] Add auth middleware to admin-extended, users, orders-advanced routes
- [ ] Change NEXT_PUBLIC_API_URL to production backend URL
- [ ] Generate separate JWT secrets for admin/restaurant/delivery
- [ ] Add CORS production origin
- [ ] Create proper production .env files
- [ ] Add rewrites in next.config.js for legacy axios calls (or fix them)

### Build & Deploy
- [ ] Run `npm run build` on clean checkout
- [ ] Verify all 52 pages build
- [ ] Deploy backend to production (render/fly/railway)
- [ ] Deploy frontend to Vercel
- [ ] Set ALL env vars in Vercel dashboard
- [ ] Run `npm run seed:admins` on production database
- [ ] Verify health endpoint: `GET /api/health`
- [ ] Verify all 4 admin logins
- [ ] Verify customer OTP flow
- [ ] Verify rider login
- [ ] Verify restaurant login
- [ ] Create production landing page for `/`

### Post-Deployment Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Add database connection pooling limits
- [ ] Add request logging to production
- [ ] Verify Socket.IO reconnection works in production

---

## RECOMMENDED PERMANENT FIXES

1. **Consolidate API access pattern** — Remove all raw `axios` and `fetch()` calls. Every frontend API call should go through `apiRequest()` from `@/lib/api` which handles auth injection, token refresh, and error handling uniformly.

2. **Auth-gate ALL backend routes** — Every route that touches data should have explicit auth middleware. Currently ~40% of routes have no auth protection.

3. **Separate JWT secrets per scope** — Use `ADMIN_JWT_SECRET`, `RESTAURANT_JWT_SECRET`, `DELIVERY_JWT_SECRET`, `CUSTOMER_JWT_SECRET` env vars.

4. **Remove legacy duplicate routes** — `/api/admin-extended` duplicates `/api/admin`. The `/api/rider-auth` duplicates `/api/delivery/auth`. Consolidate to single authoritative modules.

5. **Add request validation to ALL routes** — Currently only restaurant panel routes have express-validator. All other routes trust user input.

6. **Normalize error responses** — Some routes return `{ success: false, error: "..." }`, others return raw error objects. Standardize.

7. **Add rate limiting to ALL auth-optional routes** — Currently only admin login and OTP endpoints are rate limited.

8. **Implement refresh token rotation** — Issue new refresh token on each refresh, invalidate old one.

9. **Replace localStorage tokens with httpOnly cookies** — For XSS protection.

10. **Consider migration to Next.js API routes** — Moving backend logic into `src/app/api/` would simplify deployment (single server) and eliminate CORS issues.
