# THINAVA API Contracts

> Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:5000/api`)
> Server: Express.js on port 5000
> All timestamps in ISO 8601 unless noted.

---

## Authentication APIs

### POST /api/auth/send-otp
Send OTP for customer login/signup.

**Auth:** None (rate-limited: 10 req/15min per IP)

**Request:**
```json
{
  "phone": "9876543210",
  "country_code": "+91",
  "full_name": "John Doe",
  "email": "john@example.com",
  "purpose": "login"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "verification_id": "uuid",
  "phone": "9876543210",
  "expires_at": "2026-05-22T16:30:00.000Z",
  "resend_available_at": "2026-05-22T16:05:30.000Z",
  "helper_otp": "123456"
}
```

**Errors:** 400 (validation), 429 (rate limit)

### POST /api/auth/verify-otp
Verify OTP and authenticate.

**Auth:** None (rate-limited: 20 req/15min)

**Request:**
```json
{
  "verification_id": "uuid",
  "phone": "9876543210",
  "country_code": "+91",
  "otp": "123456",
  "full_name": "John Doe",
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "phone": "9876543210",
    "full_name": "John Doe",
    "email": "john@example.com",
    "is_verified": true,
    "created_at": "2026-01-01T00:00:00.000Z"
  },
  "is_new_user": false
}
```

**Errors:** 400 (invalid OTP), 429 (rate limit)

### POST /api/auth/refresh
Refresh JWT token.

**Auth:** Bearer token

**Response (200):**
```json
{
  "success": true,
  "token": "new-jwt-token",
  "user": { "...user object..." },
  "stats": { "total_orders": 5, "total_spent": 1250.00 }
}
```

**Errors:** 401 (invalid/expired token)

### GET /api/auth/profile
Get customer profile.

**Auth:** `authenticateCustomer` middleware

**Response (200):**
```json
{
  "success": true,
  "user": { "id": "uuid", "phone": "...", "full_name": "...", "email": "...", "profile_image": "...", "is_verified": true },
  "stats": { "total_orders": 5, "total_spent": 1250.00 }
}
```

### PUT /api/auth/profile
Update customer profile.

**Auth:** `authenticateCustomer`

**Request:**
```json
{
  "full_name": "New Name",
  "email": "new@email.com",
  "profile_image": "data:image/png;base64,..."
}
```

**Response:** `{ "success": true, "user": { "...updated..." } }`

### GET /api/auth/addresses
List customer addresses.

**Auth:** `authenticateCustomer`

**Response:**
```json
{
  "success": true,
  "addresses": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "label": "Home",
      "address": "123 Main St",
      "landmark": "Near Park",
      "latitude": 16.8128,
      "longitude": 81.5321,
      "is_default": true
    }
  ]
}
```

### POST /api/auth/addresses
Add a new address.

**Auth:** `authenticateCustomer`

**Request:**
```json
{
  "label": "Work",
  "address": "456 Office Rd",
  "landmark": "Floor 3",
  "latitude": 16.8128,
  "longitude": 81.5321,
  "is_default": false
}
```

**Response (201):** `{ "success": true, "address": { "...new address..." } }`

### PUT /api/auth/addresses/:addressId
Update an address.

**Auth:** `authenticateCustomer`

**Request:** Same shape as POST (all fields optional).

**Response:** `{ "success": true, "address": { "...updated..." } }`

### DELETE /api/auth/addresses/:addressId
Delete an address.

**Auth:** `authenticateCustomer`

**Response:** `{ "success": true, "message": "Address deleted" }`

### POST /api/auth/logout
Logout customer.

**Auth:** `authenticateCustomer`

**Response:** `{ "success": true, "message": "Logged out" }`

---

## Restaurant Auth APIs

### POST /api/restaurant-auth/register
Register a new restaurant.

**Auth:** None (rate-limited: 5 login attempts/15min, 3 signups/day/phone)

**Request:**
```json
{
  "restaurantName": "Tasty Bites",
  "ownerName": "Rajesh Kumar",
  "ownerPhone": "9876543210",
  "ownerEmail": "rajesh@tastybites.com",
  "password": "securepass123",
  "confirmPassword": "securepass123",
  "address": "123 Main Road, Tadepalligudem",
  "latitude": 16.8128,
  "longitude": 81.5321,
  "city": "Tadepalligudem",
  "state": "Andhra Pradesh",
  "pincode": "534101",
  "category": "multi-cuisine",
  "vegNonVeg": "both",
  "openingTime": "08:00",
  "closingTime": "22:00",
  "deliveryRadius": 5,
  "gstNumber": "37ABCDE1234F1Z5",
  "fssaiLicense": "FSSAI-123456"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Pending approval.",
  "restaurantId": "uuid",
  "status": "PENDING_APPROVAL",
  "nextStep": "Awaiting admin verification"
}
```

**Errors:** 400 (validation), 409 (duplicate email/phone/name)

### POST /api/restaurant-auth/login
Login for restaurant owners.

**Auth:** None

**Request:**
```json
{
  "email": "rajesh@tastybites.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token-7d-expiry",
  "user": {
    "id": "uuid",
    "restaurantId": "uuid",
    "email": "rajesh@tastybites.com",
    "fullName": "Rajesh Kumar"
  }
}
```

**Errors:** 400 (missing fields), 401 (invalid credentials), 403 (PENDING_APPROVAL/REJECTED/SUSPENDED)

### GET /api/restaurant-auth/profile
Get restaurant profile.

**Auth:** `authenticateRestaurant` (JWT, 7-day expiry)

**Response:**
```json
{
  "success": true,
  "restaurant": {
    "id": "uuid",
    "name": "Tasty Bites",
    "owner_name": "Rajesh Kumar",
    "email": "rajesh@tastybites.com",
    "phone": "9876543210",
    "gst_number": "37ABCDE1234F1Z5",
    "fssai_license": "FSSAI-123456",
    "status": "OPEN",
    "approval_status": "APPROVED",
    "is_open": true
  }
}
```

### POST /api/restaurant-auth/status/update
Update restaurant open/close status.

**Auth:** `authenticateRestaurant`

**Request:**
```json
{
  "status": "OPEN",
  "reason": "Regular hours"
}
```

**Status enums:** `OPEN`, `TEMPORARILY_UNAVAILABLE`, `CLOSED`

**Response:** `{ "success": true, "message": "...", "status": "OPEN" }`

### GET /api/restaurant-auth/status/:restaurantId
Get public restaurant status.

**Auth:** None

**Response:** `{ "success": true, "restaurant": { "id": "uuid", "name": "...", "status": "OPEN" } }`

### POST /api/restaurant-auth/logout
Logout restaurant session.

**Auth:** `authenticateRestaurant`

**Response:** `{ "success": true, "message": "Logged out" }`

---

## Rider Auth APIs

### POST /api/rider-auth/register
Register a new delivery rider.

**Auth:** None

**Request:**
```json
{
  "fullName": "Suresh Reddy",
  "phone": "9876543210",
  "password": "securepass123",
  "confirmPassword": "securepass123",
  "vehicleType": "BIKE",
  "vehicleNumber": "AP37-AB-1234",
  "email": "suresh@example.com",
  "aadharNumber": "1234-5678-9012",
  "drivingLicenseNumber": "AP37-2025-123456",
  "zone": "Tadepalligudem Central"
}
```

**Vehicle types:** `BIKE`, `SCOOTER`, `CYCLE`

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Pending approval.",
  "riderId": "uuid",
  "status": "PENDING",
  "nextStep": "Awaiting admin verification"
}
```

**Errors:** 400 (validation), 409 (duplicate phone/email/vehicle)

### POST /api/rider-auth/login
Login for delivery riders.

**Auth:** None

**Request:**
```json
{
  "phone": "9876543210",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token-7d",
  "rider": {
    "id": "uuid",
    "phone": "9876543210",
    "fullName": "Suresh Reddy",
    "isOnline": false,
    "hasActiveOrder": false
  }
}
```

**Errors:** 400 (missing fields), 401 (invalid credentials), 403 (not approved/suspended)

### GET /api/rider-auth/profile
Get rider profile.

**Auth:** `authenticateRider`

**Response:**
```json
{
  "success": true,
  "rider": {
    "id": "uuid",
    "full_name": "Suresh Reddy",
    "phone": "9876543210",
    "vehicle_type": "BIKE",
    "vehicle_number": "AP37-AB-1234",
    "zone": "Tadepalligudem Central",
    "total_deliveries": 42,
    "rating": 4.5,
    "is_online": false,
    "has_active_order": false,
    "earnings_balance": 2500.00
  }
}
```

### POST /api/rider-auth/online-status
Toggle rider online/offline status.

**Auth:** `authenticateRider`

**Request:**
```json
{
  "isOnline": true
}
```

**Response:** `{ "success": true, "message": "...", "isOnline": true }`

**Errors:** 403 (has active delivery — cannot go offline)

### POST /api/rider-auth/location
Update rider's current location.

**Auth:** `authenticateRider`

**Request:**
```json
{
  "latitude": 16.8128,
  "longitude": 81.5321,
  "accuracy": 10.5,
  "speed": 25.0,
  "orderId": "uuid"
}
```

**Response:** `{ "success": true, "message": "Location updated" }`

### POST /api/rider-auth/logout
Logout rider session.

**Auth:** `authenticateRider`

**Response:** `{ "success": true, "message": "Logged out" }`

---

## Admin Auth APIs

### POST /api/admin/auth/login
Admin login.

**Auth:** None

**Request:**
```json
{
  "email": "admin@thinava.com",
  "password": "admin-password"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt-token",
  "admin": {
    "id": "uuid",
    "email": "admin@thinava.com",
    "full_name": "Admin",
    "role": "super_admin",
    "permissions": ["dashboard:view", "orders:view", "orders:manage", "..."]
  }
}
```

**Errors:** 400 (validation), 401 (invalid credentials)

### POST /api/admin/auth/refresh
Refresh admin token.

**Auth:** Bearer token

**Response:** `{ "success": true, "token": "new-jwt", "admin": { "...admin..." } }`

### GET /api/admin/auth/profile
Get admin profile.

**Auth:** `authenticateAdmin`

**Response:** `{ "success": true, "admin": { "...admin..." } }`

---

## Admin Dashboard APIs

### GET /api/admin/dashboard
Get admin dashboard metrics.

**Auth:** `authenticateAdmin` + permission `dashboard:view`

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "metrics": {
      "total_orders": 1250,
      "active_orders": 24,
      "total_revenue": 325000.00,
      "active_riders": 15,
      "total_restaurants": 48,
      "avg_delivery_time": 28.5
    },
    "activity_feed": [
      {
        "id": "uuid",
        "action": "order_placed",
        "description": "Order #ABC123 placed",
        "timestamp": "2026-05-22T14:30:00.000Z"
      }
    ],
    "order_status_breakdown": {
      "placed": 10,
      "preparing": 8,
      "out_for_delivery": 4,
      "delivered": 1200,
      "cancelled": 28
    },
    "revenue_trend": [
      { "date": "2026-05-15", "revenue": 45000 },
      { "date": "2026-05-16", "revenue": 52000 }
    ],
    "zone_performance": [
      { "zone_name": "Tadepalligudem Central", "orders": 850, "revenue": 210000 }
    ],
    "live_map": {
      "active_deliveries": 12,
      "riders": [
        { "id": "uuid", "name": "...", "latitude": 16.8128, "longitude": 81.5321, "status": "PICKED_UP" }
      ]
    }
  }
}
```

### GET /api/admin/orders
List all orders with filters.

**Auth:** `authenticateAdmin` + `orders:view`

**Query params:** `?status=placed&restaurant_id=uuid&rider_id=uuid&area=central&payment_method=cod`

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "restaurant_id": "uuid",
      "restaurant_name": "Tasty Bites",
      "customer_name": "John Doe",
      "subtotal": 450.00,
      "delivery_fee": 30.00,
      "tax": 40.50,
      "total": 520.50,
      "status": "placed",
      "payment_method": "cod",
      "delivery_partner_id": "uuid",
      "rider_name": "Suresh",
      "created_at": "2026-05-22T14:30:00.000Z"
    }
  ],
  "summary": {
    "active": 24,
    "delayed": 3,
    "cancelled": 28,
    "cod": 800
  },
  "filters": {
    "restaurants": [{ "id": "uuid", "name": "..." }],
    "riders": [{ "id": "uuid", "name": "..." }]
  }
}
```

### PATCH /api/admin/orders/:orderId/status
Update order status from admin panel.

**Auth:** `authenticateAdmin` + `orders:manage`

**Request:**
```json
{
  "status": "out_for_delivery"
}
```

**Response:** `{ "success": true, "order": { "...updated order..." } }`

### POST /api/admin/orders/:orderId/cancel
Cancel an order from admin.

**Auth:** `authenticateAdmin` + `orders:manage`

**Request:**
```json
{
  "reason": "Customer requested cancellation"
}
```

**Response:** `{ "success": true, "...result..." }`

### POST /api/admin/orders/:orderId/mark-delivered
Force-mark an order as delivered.

**Auth:** `authenticateAdmin` + `orders:manage`

**Request:** (none)

**Response:** `{ "success": true, "...result..." }`

### POST /api/admin/orders/:orderId/reassign-rider
Reassign a different rider to an order.

**Auth:** `authenticateAdmin` + `orders:manage`, `delivery:manage`

**Request:**
```json
{
  "rider_id": "uuid"
}
```

**Response:** `{ "success": true, "...result..." }`

### GET /api/admin/restaurants
List all restaurants (admin view).

**Auth:** `authenticateAdmin` + `restaurants:view`

**Response:**
```json
{
  "success": true,
  "restaurants": [
    {
      "id": "uuid",
      "name": "Tasty Bites",
      "owner_name": "Rajesh",
      "email": "rajesh@tastybites.com",
      "status": "OPEN",
      "approval_status": "APPROVED",
      "commission_percentage": 22.00,
      "is_suspended": false,
      "total_orders": 150,
      "total_revenue": 75000.00
    }
  ],
  "summary": {
    "total": 48,
    "open": 35,
    "closed": 10,
    "suspended": 3
  }
}
```

### PATCH /api/admin/restaurants/:restaurantId
Update restaurant details or suspend/approve.

**Auth:** `authenticateAdmin` + `restaurants:manage`

**Request:** Any subset of restaurant fields: `{ "is_suspended": true, "commission_percentage": 25 }`

**Response:** `{ "success": true, "restaurant": { "...updated..." } }`

### GET /api/admin/delivery-partners
List delivery partners (admin view).

**Auth:** `authenticateAdmin` + `delivery:view`

**Response:**
```json
{
  "success": true,
  "partners": [
    {
      "id": "uuid",
      "full_name": "Suresh Reddy",
      "phone": "9876543210",
      "status": "ACTIVE",
      "is_online": true,
      "has_active_order": true,
      "vehicle_type": "BIKE",
      "total_deliveries": 42,
      "rating": 4.5,
      "earnings_balance": 2500.00
    }
  ],
  "summary": {
    "total": 25,
    "online": 15,
    "on_delivery": 12,
    "pending_approval": 3
  }
}
```

### PATCH /api/admin/delivery-partners/:partnerId
Update delivery partner.

**Auth:** `authenticateAdmin` + `delivery:manage`

**Response:** `{ "success": true, "partner": { "...updated..." } }`

### GET /api/admin/customers
List customers (admin view).

**Auth:** `authenticateAdmin` + `customers:view`

**Response:**
```json
{
  "success": true,
  "customers": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "9876543210",
      "email": "john@example.com",
      "total_orders": 15,
      "total_spent": 12500.00,
      "is_blocked": false,
      "fraud_score": 0,
      "last_order_at": "2026-05-20T14:30:00.000Z",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "summary": {
    "total": 500,
    "new_today": 5,
    "blocked": 2
  }
}
```

### PATCH /api/admin/customers/:customerId
Block/unblock customer.

**Auth:** `authenticateAdmin` + `customers:manage`

**Request:** `{ "is_blocked": true, "fraud_score": 50 }`

**Response:** `{ "success": true, "customer": { "...updated..." } }`

### GET /api/admin/analytics
Full analytics dashboard.

**Auth:** `authenticateAdmin` + `analytics:view`

**Response:**
```json
{
  "success": true,
  "analytics": {
    "order_trends": { "daily": [...], "weekly": [...], "monthly": [...] },
    "busiest_zones": [{ "zone": "Tadepalligudem Central", "orders": 850 }],
    "top_restaurants": [{ "name": "Tasty Bites", "orders": 200, "revenue": 100000 }],
    "rider_efficiency": { "avg_delivery_time": 28.5, "avg_rating": 4.3 },
    "customer_growth": { "new_customers": 25, "retention_rate": 68.5 },
    "platform_health": { "uptime": 99.8, "avg_response_time": 245 }
  }
}
```

### GET /api/admin/payments
Payment overview.

**Auth:** `authenticateAdmin` + `payments:view`

**Response:**
```json
{
  "success": true,
  "payments": {
    "overview": {
      "total_platform_revenue": 325000.00,
      "pending_payouts": 45000.00,
      "cod_collected": 210000.00
    },
    "payouts": { "restaurants": [...], "riders": [...] },
    "settlement_status": { "pending": 12, "processing": 5, "completed": 200 }
  }
}
```

### GET /api/admin/support
Support tickets listing.

**Auth:** `authenticateAdmin` + `support:view`

**Response:**
```json
{
  "success": true,
  "support": {
    "tickets": [
      {
        "id": "uuid",
        "customer_name": "John Doe",
        "subject": "Order not delivered",
        "category": "delivery_issue",
        "status": "open",
        "priority": "high",
        "created_at": "2026-05-22T10:00:00.000Z"
      }
    ],
    "summary": { "open": 8, "investigating": 3, "resolved": 45 }
  }
}
```

### PATCH /api/admin/support/:ticketId
Update support ticket.

**Auth:** `authenticateAdmin` + `support:manage`

**Response:** `{ "success": true, "ticket": { "...updated..." } }`

### GET /api/admin/promotions
List promotions and coupons.

**Auth:** `authenticateAdmin` + `promotions:view`

**Response:**
```json
{
  "success": true,
  "promotions": {
    "coupons": [
      {
        "id": "uuid",
        "code": "FLAT50",
        "title": "Flat 50 Off",
        "discount_type": "flat",
        "discount_value": 50.00,
        "minimum_order_amount": 299.00,
        "max_discount_amount": 50.00,
        "usage_limit": 100,
        "used_count": 45,
        "is_active": true,
        "expires_at": "2026-06-30T00:00:00.000Z"
      }
    ],
    "featured_restaurants": [
      { "restaurant_id": "uuid", "name": "Tasty Bites" }
    ]
  }
}
```

### POST /api/admin/promotions/coupons
Create a coupon.

**Auth:** `authenticateAdmin` + `promotions:manage`

**Request:**
```json
{
  "code": "WELCOME50",
  "title": "Welcome Offer 50",
  "description": "50% off on first order",
  "discount_type": "percentage",
  "discount_value": 50.00,
  "minimum_order_amount": 199.00,
  "max_discount_amount": 100.00,
  "usage_limit": 500,
  "ends_at": "2026-12-31T23:59:59.000Z",
  "is_active": true
}
```

**Response (201):** `{ "success": true, "coupon": { "...new coupon..." } }`

### GET /api/admin/settings
Get platform settings.

**Auth:** `authenticateAdmin` + `settings:view`

**Response:** `{ "success": true, "settings": [{ "key": "commission_rate", "value": 22 }] }`

### PUT /api/admin/settings
Update platform settings.

**Auth:** `authenticateAdmin` + `settings:manage`

**Request:** `{ "settings": [{ "setting_key": "commission_rate", "setting_value": 25 }] }`

**Response:** `{ "success": true, "settings": [...updated...] }`

### GET /api/admin/live-map
Live delivery map data.

**Auth:** `authenticateAdmin` + `map:view`

**Response:** `{ "success": true, "liveMap": { "riders": [...], "orders": [...] } }`

---

## Admin Extended APIs (Governance/Approvals)

### GET /api/admin-extended/restaurants/pending
**Auth:** None

**Response:** `{ "success": true, "pending": [...], "count": 3 }`

### GET /api/admin-extended/restaurants/approvals
**Auth:** None

**Query:** `?status=APPROVED`

**Response:** `{ "success": true, "approvals": [...] }`

### POST /api/admin-extended/restaurants/:id/approve
**Auth:** None

**Request:** `{ "notes": "Documents verified", "approvedByAdminId": "uuid" }`

**Response:** `{ "success": true, "message": "...approved" }`

### POST /api/admin-extended/restaurants/:id/reject
**Auth:** None

**Request:** `{ "rejectionReason": "Invalid documents", "rejectedByAdminId": "uuid" }`

**Response:** `{ "success": true, "message": "...rejected" }`

### GET /api/admin-extended/riders/pending
**Auth:** None

**Response:** `{ "success": true, "pending": [...], "count": 2 }`

### POST /api/admin-extended/riders/:id/approve
**Auth:** None

**Response:** `{ "success": true, "message": "...approved" }`

### POST /api/admin-extended/riders/:id/reject
**Auth:** None

**Response:** `{ "success": true, "message": "...rejected" }`

### POST /api/admin-extended/restaurants/register-manual
Admin manually registers a restaurant (auto-approved).

**Auth:** None

**Request:** Same as `/api/restaurant-auth/register`

**Response (201):**
```json
{
  "success": true,
  "restaurantId": "uuid",
  "status": "APPROVED",
  "user": { "email": "...", "password": "auto-generated" }
}
```

### POST /api/admin-extended/riders/register-manual
Admin manually registers a rider (auto-approved).

**Auth:** None

**Response (201):**
```json
{
  "success": true,
  "riderId": "uuid",
  "status": "ACTIVE"
}
```

### GET /api/admin-extended/restaurants
**Auth:** None

**Response:** `{ "success": true, "restaurants": [...] }`

### PUT /api/admin-extended/restaurants/:id/status
**Auth:** None

**Request:** `{ "status": "CLOSED", "approval_status": "SUSPENDED" }`

**Response:** `{ "success": true, "message": "Status updated" }`

### DELETE /api/admin-extended/restaurants/:id
⚠️ **DANGER:** Hard deletes restaurant. Cascades to menu_items, orders, reviews, etc.

**Auth:** None

**Response:** `{ "success": true, "message": "Restaurant deleted" }`

### GET /api/admin-extended/riders
**Auth:** None

**Response:** `{ "success": true, "riders": [...] }`

### PUT /api/admin-extended/riders/:id/status
**Auth:** None

**Response:** `{ "success": true, "message": "Status updated" }`

### DELETE /api/admin-extended/riders/:id
⚠️ **DANGER:** Hard deletes rider. Cascades to all delivery records.

**Auth:** None

**Response:** `{ "success": true, "message": "Rider deleted" }`

### Admin Menu Management (scoped to restaurant)

| METHOD | ROUTE | DESCRIPTION |
|--------|-------|-------------|
| GET | `/api/admin-extended/restaurants/:id/menu` | List menu with categories |
| POST | `/api/admin-extended/restaurants/:id/category` | Create category |
| PUT | `/api/admin-extended/restaurants/:id/category/:categoryId` | Update category |
| DELETE | `/api/admin-extended/restaurants/:id/category/:categoryId` | Delete category |
| PUT | `/api/admin-extended/restaurants/:id/categories/reorder` | Reorder categories |
| POST | `/api/admin-extended/restaurants/:id/item` | Create menu item |
| PUT | `/api/admin-extended/restaurants/:id/item/:itemId` | Update menu item |
| PATCH | `/api/admin-extended/restaurants/:id/item/:itemId/stock` | Toggle stock |
| DELETE | `/api/admin-extended/restaurants/:id/item/:itemId` | Delete menu item |
| POST | `/api/admin-extended/restaurants/:id/item/:itemId/variant` | Create variant |
| PUT | `/api/admin-extended/restaurants/:id/item/:itemId/variant/:variantId` | Update variant |
| DELETE | `/api/admin-extended/restaurants/:id/item/:itemId/variant/:variantId` | Delete variant |
| POST | `/api/admin-extended/restaurants/:id/item/:itemId/addon` | Create addon |
| PUT | `/api/admin-extended/restaurants/:id/item/:itemId/addon/:addonId` | Update addon |
| DELETE | `/api/admin-extended/restaurants/:id/item/:itemId/addon/:addonId` | Delete addon |

**Category create request:**
```json
{ "name": "Starters", "description": "Appetizers", "displayOrder": 1 }
```

**Menu item create request:**
```json
{
  "name": "Chicken Biryani",
  "price": 250.00,
  "description": "Fragrant basmati rice with chicken",
  "offerPrice": 220.00,
  "image": "url",
  "categoryId": "uuid",
  "isVeg": false,
  "isBestseller": true,
  "isRecommended": false,
  "isAvailable": true,
  "inStock": true,
  "preparationTime": 25,
  "spiceLevel": "medium",
  "calories": 650,
  "displayOrder": 1
}
```

**All menu write responses:** `{ "success": true, "item": {...} }` (201 for creates)

---

## Restaurant Panel APIs (`/api/restaurant`)

All routes except auth require `authenticateRestaurantOwner` middleware (JWT).

### POST /api/restaurant/auth/login
**Auth:** None

**Request:** `{ "email": "...", "password": "..." }`

**Response:** `{ "success": true, "token": "jwt", "user": {...} }`

### GET /api/restaurant/auth/me
**Auth:** `authenticateRestaurantOwner`

**Response:** `{ "success": true, "user": {...} }`

### GET /api/restaurant/orders/summary
Dashboard order summary for the restaurant.

**Auth:** `authenticateRestaurantOwner`

**Response:** Dashboard metrics (total orders, active orders, revenue)

### GET /api/restaurant/orders
List restaurant's orders.

**Auth:** `authenticateRestaurantOwner`

**Response:** `{ "success": true, "orders": [...] }`

### PATCH /api/restaurant/orders/:orderId/status
Update order status from restaurant panel.

**Auth:** `authenticateRestaurantOwner`

**Request:**
```json
{
  "status": "PREPARING"
}
```

**Status valid transitions:** PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP

**Response:** `{ "success": true, "order": {...} }`

### Menu CRUD (All require `authenticateRestaurantOwner`)

| METHOD | ROUTE | DESCRIPTION |
|--------|-------|-------------|
| GET | `/api/restaurant/menu` | List all menu items |
| POST | `/api/restaurant/menu` | Create item |
| PUT | `/api/restaurant/menu/:menuItemId` | Update item |
| PATCH | `/api/restaurant/menu/:menuItemId/stock` | Toggle stock |
| DELETE | `/api/restaurant/menu/:menuItemId` | Delete item |
| POST | `/api/restaurant/menu/:menuItemId/variant` | Create variant |
| PUT | `/api/restaurant/menu/:menuItemId/variant/:variantId` | Update variant |
| DELETE | `/api/restaurant/menu/:menuItemId/variant/:variantId` | Delete variant |
| POST | `/api/restaurant/menu/:menuItemId/addon` | Create addon |
| PUT | `/api/restaurant/menu/:menuItemId/addon/:addonId` | Update addon |
| DELETE | `/api/restaurant/menu/:menuItemId/addon/:addonId` | Delete addon |
| GET | `/api/restaurant/categories` | List categories |
| POST | `/api/restaurant/categories` | Create category |
| PUT | `/api/restaurant/categories/reorder` | Reorder categories |
| PUT | `/api/restaurant/categories/:categoryId` | Update category |
| DELETE | `/api/restaurant/categories/:categoryId` | Delete category |
| GET | `/api/restaurant/settings` | Get settings |
| PUT | `/api/restaurant/settings` | Update settings |
| GET | `/api/restaurant/analytics` | Get analytics |

---

## Delivery Partner APIs (`/api/delivery`)

### POST /api/delivery/auth/register
**Auth:** None

**Request:** `{ "fullName", "phone", "password", "vehicleType", "vehicleNumber", ... }`

**Response (201):** `{ "success": true, "riderId": "uuid", "status": "PENDING" }`

### POST /api/delivery/auth/login
**Auth:** None

**Request:** `{ "phone", "password" }`

**Response:** `{ "success": true, "token": "jwt", "rider": {...} }`

### GET /api/delivery/auth/profile
**Auth:** `authenticateDeliveryPartner`

**Response:** `{ "success": true, "rider": {...} }`

### POST /api/delivery/auth/online-status
**Auth:** `authenticateDeliveryPartner`

**Request:** `{ "isOnline": true }`

**Response:** `{ "success": true, "message": "...", "isOnline": true }`

### GET /api/delivery/orders
Get available orders for delivery.

**Auth:** `authenticateDeliveryPartner`

**Response:** `{ "success": true, "orders": [...] }`

### POST /api/delivery/orders/accept
Accept an order.

**Auth:** `authenticateDeliveryPartner`

**Request:** `{ "orderId": "uuid" }`

**Response:** `{ "success": true, ... }`

### POST /api/delivery/orders/reject
Reject an order.

**Auth:** `authenticateDeliveryPartner`

**Request:** `{ "orderId": "uuid", "reason": "Too far" }`

**Response:** `{ "success": true, ... }`

### GET /api/delivery/orders/active
Get rider's active delivery.

**Auth:** `authenticateDeliveryPartner`

**Response:** `{ "success": true, "activeOrder": {...} }`

### POST /api/delivery/orders/status
Update order delivery status.

**Auth:** `authenticateDeliveryPartner`

**Request:** `{ "orderId": "uuid", "status": "ARRIVED_AT_RESTAURANT" }`

**Response:** `{ "success": true, ... }`

### POST /api/delivery/location
Update rider location.

**Auth:** `authenticateDeliveryPartner`

**Request:** `{ "latitude", "longitude", "accuracy?", "speed?" }`

**Response:** `{ "success": true, "message": "Location updated" }`

### GET /api/delivery/earnings/:period
Get earnings (today, week, month, history).

**Auth:** `authenticateDeliveryPartner`

**Response:** `{ "success": true, "earnings": {...}, "total": 1200 }`

### GET /api/delivery/shifts
Get booked shifts.

**Auth:** `authenticateDeliveryPartner`

**Response:** `{ "success": true, "shifts": [...] }`

### POST /api/delivery/shifts/book
Book a shift.

**Auth:** `authenticateDeliveryPartner`

**Request:** `{ "shiftId": "uuid" }`

**Response:** `{ "success": true, ... }`

---

## Customer APIs (Public/Facing)

### GET /api/restaurants
List all restaurants.

**Auth:** None

**Query params:** `?featured=true&cuisine=Italian`

**Response:**
```json
{
  "success": true,
  "restaurants": [
    {
      "id": "uuid",
      "name": "Tasty Bites",
      "image": "url",
      "logo": "url",
      "rating": 4.5,
      "delivery_time": "25-35 mins",
      "price_for_one": 250.00,
      "cuisines": ["Indian", "Chinese"],
      "offer": "20% OFF",
      "featured": true,
      "is_open": true,
      "formatted_address": "123 Main Rd, Tadepalligudem"
    }
  ]
}
```

### GET /api/restaurants/:id
Get restaurant details.

**Auth:** None

**Response:** `{ "success": true, "restaurant": { "...full details..." } }`

### GET /api/menu/restaurant/:restaurantId
Get menu for a restaurant.

**Auth:** None

**Response:**
```json
{
  "success": true,
  "categories": [{ "id": "uuid", "name": "Starters", "display_order": 1 }],
  "menuItems": [
    {
      "id": "uuid",
      "restaurant_id": "uuid",
      "name": "Chicken Biryani",
      "description": "Fragrant rice",
      "price": 250.00,
      "offer_price": 220.00,
      "image": "url",
      "category": "Biryani",
      "category_id": "uuid",
      "is_veg": false,
      "is_bestseller": true,
      "in_stock": true,
      "preparation_time": 25,
      "spice_level": "medium",
      "calories": 650,
      "variants": [{ "id": "uuid", "name": "Full", "price": 250.00, "offer_price": 220.00, "is_default": true }],
      "addons": [{ "id": "uuid", "name": "Extra Cheese", "price": 30.00, "is_required": false }]
    }
  ]
}
```

### GET /api/menu/:id
Get single menu item.

**Auth:** None

**Response:** `{ "success": true, "menuItem": { "...full item with variants/addons..." } }`

### GET /api/search
Search restaurants and menu items.

**Auth:** None

**Query params:** `?q=biryani&veg=true&rating=4&maxPrice=300`

**Response:** `{ "success": true, "restaurants": [...], "menuItems": [...] }`

### GET /api/coupons/active
Get active coupons.

**Auth:** None

**Response:**
```json
{
  "success": true,
  "coupons": [
    { "id": "uuid", "code": "FLAT50", "description": "Flat 50 off", "discount_type": "FLAT", "discount_value": 50.00, "min_order": 299.00, "max_discount": 50.00 }
  ]
}
```

### POST /api/coupons/validate
Validate and apply a coupon.

**Auth:** None

**Request:**
```json
{
  "code": "FLAT50",
  "subtotal": 450.00,
  "deliveryFee": 30.00
}
```

**Response (200 - valid):**
```json
{
  "success": true,
  "valid": true,
  "coupon": { "code": "FLAT50", "description": "...", "discount_type": "FLAT", "discount_value": 50 },
  "discountAmount": 50.00
}
```

**Response (200 - invalid):**
```json
{
  "success": true,
  "valid": false,
  "message": "Minimum order amount 299 required"
}
```

---

## Order APIs

### GET /api/orders/user/:userId
Get orders for a user.

**Auth:** `authenticateCustomer` (must match userId)

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "restaurant_id": "uuid",
      "restaurant": { "name": "Tasty Bites", "image": "url" },
      "rider": { "name": "Suresh", "phone": "9876543210", "image": "url" },
      "address": { "label": "Home", "full_address": "123 Main St" },
      "subtotal": 450.00,
      "delivery_fee": 30.00,
      "tax": 40.50,
      "total": 520.50,
      "status": "delivered",
      "payment_method": "cod",
      "estimated_delivery": "25-35 mins",
      "items": [{ "menu_item_id": "uuid", "name": "Chicken Biryani", "quantity": 1, "price": 250.00 }],
      "created_at": "2026-05-22T14:30:00.000Z",
      "delivered_at": "2026-05-22T15:00:00.000Z"
    }
  ]
}
```

### GET /api/orders/:id
Get single order details.

**Auth:** None

**Response:** `{ "success": true, "order": { "...full order with items..." } }`

### POST /api/orders
Create a new order.

**Auth:** None (supports guest checkout)

**Request:**
```json
{
  "user_id": "uuid",
  "restaurant_id": "uuid",
  "address_id": "uuid",
  "delivery_address": {
    "label": "Home",
    "full_address": "123 Main St",
    "landmark": "Near Park",
    "latitude": 16.8128,
    "longitude": 81.5321
  },
  "items": [
    { "menu_item_id": "uuid", "name": "Chicken Biryani", "quantity": 1, "price": 250.00, "notes": "Extra spicy" }
  ],
  "subtotal": 450.00,
  "delivery_fee": 30.00,
  "tax": 40.50,
  "total": 520.50,
  "payment_method": "cod"
}
```

**Response (201):**
```json
{
  "success": true,
  "order": { "...created order..." }
}
```

### PUT /api/orders/:id/status
Update order status.

**Auth:** None

**Request:**
```json
{
  "status": "out_for_delivery"
}
```

**Response:** `{ "success": true, "order": { "...updated..." } }`

---

## Reviews & Ratings APIs

### POST /api/reviews
Submit review for restaurant and/or rider.

**Auth:** `authenticateCustomer`

**Request:**
```json
{
  "order_id": "uuid",
  "restaurant_id": "uuid",
  "rider_id": "uuid",
  "restaurant_rating": 4,
  "restaurant_comment": "Great food!",
  "rider_rating": 5,
  "rider_comment": "Fast delivery"
}
```

**Ratings:** 1-5 integer range

**Response (201):**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "restaurantReview": { "id": "uuid", "rating": 4 },
  "riderReview": { "id": "uuid", "rating": 5 }
}
```

**Errors:** 400 (invalid rating/double review/not delivered), 404 (order not found)

### GET /api/reviews/restaurant/:restaurantId
Get reviews for a restaurant.

**Auth:** None

**Response:** `{ "success": true, "reviews": [...] }`

### GET /api/reviews/rider/:riderId
Get reviews for a rider.

**Auth:** None

**Response:** `{ "success": true, "reviews": [...] }`

### GET /api/ratings/eligibility
Check which orders a customer can rate.

**Auth:** `authenticateCustomer`

**Response:**
```json
{
  "success": true,
  "orders": [
    { "id": "uuid", "restaurant_name": "Tasty Bites", "rider_name": "Suresh", "already_rated": false, "can_rate": true }
  ],
  "unrated_count": 2
}
```

### POST /api/ratings/submit
Submit comprehensive rating for an order.

**Auth:** `authenticateCustomer`

**Request:**
```json
{
  "orderId": "uuid",
  "restaurant_rating": 4,
  "rider_rating": 5,
  "food_quality": 4,
  "delivery_speed": 5,
  "overall_rating": 4,
  "review_text": "Great experience!",
  "is_anonymous": false
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Rating submitted successfully",
  "review_id": "uuid"
}
```

### GET /api/ratings/restaurant/:restaurantId
Get aggregated rating for a restaurant.

**Auth:** None

**Response:**
```json
{
  "success": true,
  "rating": {
    "average": 4.2,
    "total": 150,
    "distribution": { "1": 5, "2": 8, "3": 15, "4": 50, "5": 72 }
  },
  "reviews": [...]
}
```

### GET /api/ratings/rider/:riderId
Get aggregated rating for a rider.

**Auth:** None

**Response:**
```json
{
  "success": true,
  "rating": { "average": 4.5, "speed": 4.3, "total": 42 }
}
```

---

## Orders Advanced APIs

### POST /api/orders-advanced/create
Create order with full validation.

**Auth:** None

**Request:**
```json
{
  "userId": "uuid",
  "restaurantId": "uuid",
  "addressId": "uuid",
  "items": [{ "menuItemId": "uuid", "name": "Chicken Biryani", "quantity": 1, "price": 250, "notes": "" }],
  "subtotal": 450,
  "deliveryFee": 30,
  "tax": 40.50,
  "total": 520.50,
  "paymentMethod": "cod",
  "specialInstructions": "Ring the bell"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "orderId": "uuid",
  "status": "PLACED"
}
```

### POST /api/orders-advanced/:id/assign-rider
Assign a rider to an order.

**Auth:** None

**Request:** `{ "riderId": "uuid", "assignmentMethod": "auto" }`

**Response:** `{ "success": true, "orderId": "uuid", "riderId": "uuid", "status": "ASSIGNED" }`

### POST /api/orders-advanced/:id/accept
Accept order (restaurant action).

**Auth:** None

**Response:** `{ "success": true, "orderId": "uuid", "status": "CONFIRMED" }`

### POST /api/orders-advanced/:id/reject
Reject order.

**Auth:** None

**Request:** `{ "reason": "Out of stock" }`

**Response:** `{ "success": true, "orderId": "uuid", "status": "REJECTED" }`

### POST /api/orders-advanced/:id/ready-for-pickup
Mark order ready.

**Auth:** None

**Response:** `{ "success": true, "orderId": "uuid", "status": "READY_FOR_PICKUP" }`

### POST /api/orders-advanced/:id/picked-up
Mark order picked up.

**Auth:** None

**Response:** `{ "success": true, "orderId": "uuid", "status": "PICKED_UP" }`

### POST /api/orders-advanced/:id/delivered
Mark order delivered.

**Auth:** None

**Response:** `{ "success": true, "orderId": "uuid", "status": "DELIVERED" }`

---

## User APIs

### GET /api/users/:userId/addresses
Get user addresses.

**Auth:** None

**Response:** `{ "success": true, "addresses": [...] }`

### POST /api/users/:userId/addresses
Add address.

**Auth:** None

**Request:** `{ "label", "full_address", "landmark", "is_default" }`

**Response (201):** `{ "success": true, "address": {...} }`

### PUT /api/users/:userId/addresses/:addressId
Update address.

**Auth:** None

**Response:** `{ "success": true, "address": {...} }`

### DELETE /api/users/:userId/addresses/:addressId
Delete address.

**Auth:** None

**Response:** `{ "success": true, "message": "Address deleted" }`

### PUT /api/users/:userId
Update user profile.

**Auth:** None

**Request:** `{ "name", "email" }`

**Response:** `{ "success": true, "user": {...} }`

---

## Health & Dev APIs

### GET /api/health
**Auth:** None

**Response:** `{ "status": "ok", "message": "Thinava API is running" }`

### GET /api/dev/delivery-count
Dev only (403 in production). Returns delivery partner count.

### GET /api/dev/test-orders
Dev only (403 in production). Returns sample orders for testing.

---

## Status Enum Reference

### Order Status (Restaurant Panel)
```
PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED
                                                                        → CANCELLED (any state)
```

### Order Status (Frontend Normalized)
```
placed, accepted, preparing, ready_for_pickup, out_for_delivery, delivered, cancelled
```

### Delivery Status
```
PENDING → ASSIGNED → ARRIVED_AT_RESTAURANT → PICKED_UP → ON_THE_WAY → REACHED_CUSTOMER → DELIVERED
                                                                                           → CANCELLED
```

### Restaurant Status
```
OPEN, CLOSED, TEMPORARILY_UNAVAILABLE
```

### Restaurant Approval Status
```
PENDING, APPROVED, REJECTED, SUSPENDED
```

### Rider/Delivery Partner Status
```
PENDING, APPROVED, REJECTED, SUSPENDED, ACTIVE, INACTIVE
```

### Payment Methods
```
cod, upi
```

### Discount Types
```
flat, percentage
```

### Payment Status
```
pending, paid, cancelled, refunded, cod_pending, cod_collected
```

### Admin Roles
```
super_admin, operations_manager, support_agent, finance_admin
```
