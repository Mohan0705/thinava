# THINAVA Database Notes

> Database: Supabase PostgreSQL (hosted)
> Connection: `postgresql://postgres.dcitybxftidseaeogcos:...@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
> Pool: `pg` with SSL (`rejectUnauthorized: false`)

---

## Tables

### Core Tables

| Table | Purpose | Rows Est. | Key Columns |
|-------|---------|-----------|-------------|
| `users` | Customer accounts | High | `id` (UUID PK), `phone` (UNIQUE), `full_name`, `email`, `is_verified`, `is_blocked`, `fraud_score` |
| `addresses` | Customer addresses | High | `id` (UUID PK), `user_id` (FK→users), `label`, `full_address`, `latitude`, `longitude`, `is_default` |
| `user_addresses` | Newer address system | Medium | `id` (UUID PK), `user_id` (FK→users), `label`, `address`, `latitude`, `longitude`, `is_default`, `legacy_address_id` |
| `restaurants` | Restaurant listings | Low-Med | `id` (UUID PK), `name`, `image`, `cuisines` (TEXT[]), `rating`, `is_open`, `status`, `approval_status`, `featured`, `latitude`, `longitude`, `zone_name` |
| `menu_items` | Menu items per restaurant | Medium | `id` (UUID PK), `restaurant_id` (FK→restaurants), `name`, `price`, `category`, `is_veg`, `in_stock`, `category_id` (FK→restaurant_categories) |
| `orders` | Customer orders | High | `id` (UUID PK), `user_id`, `restaurant_id`, `address_id`, `subtotal`, `total`, `status`, `payment_method`, `delivery_partner_id`, `delivery_status` |
| `order_items` | Items within orders | High | `id` (UUID PK), `order_id` (FK→orders), `menu_item_id`, `quantity`, `price`, `notes` |

### Restaurant Panel Tables

| Table | Purpose | Notes |
|-------|---------|-------|
| `restaurant_users` | Restaurant owner accounts | `restaurant_id` FK→restaurants, `email` UNIQUE, `password_hash` |
| `restaurant_categories` | Menu categories per restaurant | `(restaurant_id, name)` UNIQUE |
| `restaurant_item_variants` | Item size/price variants | `menu_item_id` FK→menu_items CASCADE |
| `restaurant_item_addons` | Item addon options | `menu_item_id` FK→menu_items CASCADE |
| `restaurant_details` | Extended restaurant details | 1:1 with restaurants, `owner_name`, `gst_number`, `fssai_license`, `bank_account_verified` |
| `restaurant_approvals` | Registration approval flow | `restaurant_id` FK→restaurants, tracks PENDING→APPROVED/REJECTED |
| `restaurant_status_logs` | Status change audit | `restaurant_id` FK→restaurants, `status`, `changed_by`, `reason` |

### Delivery System Tables

| Table | Purpose | Notes |
|-------|---------|-------|
| `delivery_partners` | Rider accounts | `phone` UNIQUE, `email` UNIQUE, `password_hash`, `status`, `is_online`, `rating_sum`, `rating_count` |
| `rider_details` | Extended rider info | 1:1 with delivery_partners, `vehicle_type`, `vehicle_number`, `zone`, `total_deliveries` |
| `delivery_wallets` | Rider earnings wallet | 1:1 with delivery_partners, `available_balance`, `pending_balance`, `cod_collected` |
| `delivery_locations` | Rider location history | `delivery_partner_id` FK, `latitude`, `longitude`, `timestamp` |
| `delivery_assignments` | Order-to-rider assignments | `order_id`, `delivery_partner_id` (FK→delivery_partners **RESTRICT**), `assignment_status` |
| `active_deliveries` | Currently active deliveries | `order_id` PK FK→orders CASCADE, `delivery_partner_id` FK CASCADE |
| `delivery_tracking` | Real-time tracking state | `order_id` PK FK→orders CASCADE, current location/eta |
| `delivery_shifts` | Rider shift bookings | `delivery_partner_id` FK, `shift_date`, `slot_label`, `zone_name` |
| `delivery_earnings` | Per-delivery earnings | `delivery_partner_id`, `order_id`, `amount`, `incentive` |
| `delivery_incentives` | Bonus/incentive records | Links to `delivery_incentive_rules` |
| `delivery_payouts` | Withdrawal requests | `delivery_partner_id`, `amount`, `status` (requested/processed) |

### Admin Tables

| Table | Purpose | Notes |
|-------|---------|-------|
| `admin_users` | Admin accounts | `email` UNIQUE, `password_hash`, `role`, `permissions` (JSONB) |
| `admin_activity_logs` | Admin action audit trail | `admin_user_id`, `action`, `entity_type`, `entity_id`, `metadata` (JSONB), `ip_address` |
| `support_tickets` | Customer support tickets | `customer_id`, `order_id`, `assigned_admin_id`, `status` (open/investigating/resolved) |
| `coupon_codes` | Promotional coupons | `code` UNIQUE, `discount_type` (flat/percentage), `discount_value`, `usage_limit`, `used_count` |
| `platform_settings` | Key-value platform config | `setting_key` UNIQUE, `setting_value` (JSONB), `category` |
| `payout_transactions` | Restaurant/rider payouts | `entity_type` (restaurant/rider), `order_id`, `amount`, `status` |

### Review & Rating Tables

| Table | Purpose | Notes |
|-------|---------|-------|
| `restaurant_reviews` | Restaurant reviews | `restaurant_id`, `user_id`, `order_id`, `rating` (1-5), `comment` |
| `rider_reviews` | Rider reviews | `rider_id`, `user_id`, `order_id`, `rating` (1-5), `comment` |
| `restaurant_ratings` | Restaurant ratings (newer) | `order_id` UNIQUE, `restaurant_id`, `customer_id`, `rating` (1-5), `food_quality`, `review_text` |
| `rider_ratings` | Rider ratings (newer) | `order_id` UNIQUE, `rider_id`, `customer_id`, `rating` (1-5), `delivery_speed`, `behavior`, `review_text` |
| `order_reviews` | Unified order reviews | `order_id` UNIQUE, `customer_id`, all rating dimensions (restaurant/rider/food/delivery/overall) |

### Misc Tables

| Table | Purpose |
|-------|---------|
| `customer_otp_sessions` | OTP verification sessions |
| `order_status_history` | Order state machine audit trail |
| `active_delivery_sessions` | Legacy delivery session tracking |
| `socket_events_log` | WebSocket event audit log |
| `coupons` | Legacy coupon codes (separate from coupon_codes) |
| `rider_approval_logs` | Rider approval audit |
| `restaurant_approval_history` | Restaurant approval audit |

---

## Foreign Key Relationships

```
users
  └── addresses.user_id → CASCADE
  └── user_addresses.user_id → CASCADE
  └── orders.user_id → CASCADE
  └── restaurant_reviews.user_id → CASCADE
  └── rider_reviews.user_id → CASCADE
  └── restaurant_ratings.customer_id → CASCADE
  └── rider_ratings.customer_id → CASCADE
  └── order_reviews.customer_id → CASCADE
  └── support_tickets.customer_id → SET NULL

restaurants
  └── menu_items.restaurant_id → CASCADE
  └── restaurant_categories.restaurant_id → CASCADE
  └── restaurant_users.restaurant_id → CASCADE
  └── restaurant_details.restaurant_id → CASCADE
  └── restaurant_approvals.restaurant_id → CASCADE
  └── restaurant_reviews.restaurant_id → CASCADE
  └── restaurant_ratings.restaurant_id → CASCADE
  └── coupon_codes.featured_restaurant_id → SET NULL
  └── orders.restaurant_id → (no action - DANGER)

menu_items
  └── restaurant_item_variants.menu_item_id → CASCADE
  └── restaurant_item_addons.menu_item_id → CASCADE
  └── order_items.menu_item_id → (no action)
  └── menu_items.category_id → restaurant_categories → SET NULL

orders
  └── order_items.order_id → CASCADE
  └── order_status_history.order_id → CASCADE
  └── restaurant_reviews.order_id → CASCADE
  └── rider_reviews.order_id → CASCADE
  └── restaurant_ratings.order_id → CASCADE
  └── rider_ratings.order_id → CASCADE
  └── order_reviews.order_id → CASCADE
  └── active_deliveries.order_id → CASCADE
  └── delivery_tracking.order_id → CASCADE
  └── delivery_assignments.order_id → CASCADE
  └── delivery_earnings.order_id → CASCADE
  └── orders.delivery_partner_id → delivery_partners → SET NULL

delivery_partners
  └── rider_details.delivery_partner_id → CASCADE
  └── delivery_wallets.delivery_partner_id → CASCADE
  └── delivery_locations.delivery_partner_id → CASCADE
  └── delivery_assignments.delivery_partner_id → RESTRICT
  └── active_deliveries.delivery_partner_id → CASCADE
  └── delivery_earnings.delivery_partner_id → CASCADE
```

---

## CASCADE Behaviors - DANGER ZONES

### ⚠️ Deleting a Restaurant Cascades To:
- `menu_items` → then cascades to `restaurant_item_variants` + `restaurant_item_addons`
- `restaurant_categories`
- `restaurant_users`
- `restaurant_details`
- `restaurant_approvals`
- `restaurant_status_logs`
- `restaurant_reviews`
- `restaurant_ratings`
- `restaurant_approval_history`

**BUT does NOT cascade to:**
- `orders` (no action — orphaned `restaurant_id`)
- `coupon_codes.featured_restaurant_id` (SET NULL)

### ⚠️ Deleting a User Cascades To:
- `addresses`
- `user_addresses`
- `orders` (then cascades to `order_items`, `order_status_history`, all reviews, all ratings)
- `restaurant_reviews`
- `rider_reviews`
- `restaurant_ratings`
- `rider_ratings`
- `order_reviews`

### ⚠️ Deleting a Delivery Partner Cascades To:
- `rider_details`
- `delivery_wallets`
- `delivery_payouts`
- `delivery_shifts`
- `delivery_incentives`
- `delivery_locations`
- `active_deliveries`
- `delivery_tracking`
- `delivery_earnings`

**BUT:** `delivery_assignments` uses **RESTRICT** — prevents deletion if assignments exist.

---

## Enums (Application-Level, VARCHAR columns)

### Order Status (Normalized)
```
placed, accepted, preparing, ready_for_pickup, out_for_delivery, delivered, cancelled
```

### Delivery Status
```
PENDING, ASSIGNED, ARRIVED_AT_RESTAURANT, PICKED_UP, ON_THE_WAY, REACHED_CUSTOMER, DELIVERED, CANCELLED
```

### Restaurant Status
```
OPEN, CLOSED, TEMPORARILY_UNAVAILABLE
```

### Restaurant Approval Status
```
PENDING, APPROVED, REJECTED, SUSPENDED
```

### Rider Status
```
PENDING, APPROVED, REJECTED, SUSPENDED, ACTIVE, INACTIVE
```

### Admin Roles
```
super_admin, operations_manager, support_agent, finance_admin
```

### Discount Types
```
flat, percentage
```

### Payment Methods
```
cod, upi
```

### Payment Status
```
pending, paid, cancelled, refunded, cod_pending, cod_collected
```

### Support Ticket Status
```
open, investigating, resolved
```

---

## Migrations (in order of execution)

| # | Script | What it does |
|---|--------|-------------|
| 1 | `ensureRestaurantPanelSchema.js` | Creates core tables (users, addresses, restaurants, menu_items, orders, order_items, restaurant_users, restaurant_categories) + delivery tables + seeds |
| 2 | `ensureAdminSchema.js` | Creates admin tables + seeds admin accounts + default settings |
| 3 | `ensureCustomerAuthSchema.js` | Adds auth columns to users, creates customer_otp_sessions, user_addresses |
| 4 | `ensureRestaurantRegistrationSchema.js` | Adds phone/category/veg_non_veg to restaurants |
| 5 | `ensureDeliveryLogisticsSchema.js` | Adds delivery columns to orders/restaurants/delivery_partners, wallet/payout/shift/incentive tables |
| 6 | `ensureFeaturesSchema.js` | Creates coupons, restaurant_reviews, rider_reviews, seeds coupons |
| 7 | `ensureOrderPrivacyAndRatingSchema.js` | Adds payment_status, creates restaurant_ratings, rider_ratings, order_reviews |
| 8 | `ensureRestaurantMenuSchema.js` | DROPS old admin_menu_categories/admin_food_items/restaurant_menu_mappings, enhances menu_items, creates variants/addons tables |
| 9 | `add-notes-to-order-items.js` | Adds `notes` column to order_items |
| 10 | `add-order-lifecycle-columns.js` | Adds delivery lifecycle columns to orders + delivery tables |

---

## Nullable Fields (Watch for null checks)

### orders
- `delivery_partner_id` — nullable (SET NULL on rider delete)
- `rider_name`, `rider_phone`, `rider_image` — nullable
- `cancellation_reason`, `rejected_at`, `picked_up_at`, `delivered_at` — nullable
- `estimated_delivery` — nullable
- All delivery ETA/distance fields — nullable

### restaurants
- `offer`, `banner_image`, `description` — nullable
- `opening_time`, `closing_time` — nullable
- `formatted_address`, `place_id` — nullable
- `phone`, `category`, `veg_non_veg` — nullable (added later)
- `latitude`, `longitude` — nullable
- `rating_sum`, `rating_count` — nullable (added by rating migration)

### menu_items
- `description`, `image` — nullable
- `offer_price`, `preparation_time`, `spice_level`, `calories` — nullable
- `category_id` — nullable (SET NULL on category delete)

### delivery_partners
- `email`, `profile_image` — nullable
- `aadhar_number`, `driving_license` — nullable
- Document fields — nullable

---

## Important Rules

### 1. Never Hard-Delete Restaurants with Active Orders
Deleting a restaurant does NOT cascade to orders (`orders.restaurant_id` has no ON DELETE action). This orphaned reference will cause JOIN failures. Solution: soft-delete via `is_suspended` instead.

### 2. Prevent Orphan Review References
All review/rating tables CASCADE on restaurant/user/order delete. Deleting a restaurant will wipe all its reviews and ratings. This can crash the admin reviews page. Always null-check review data before rendering.

### 3. Validate UUID Before DB Queries
Invalid UUIDs cause PostgreSQL errors. Always validate with a UUID regex before passing to `WHERE id = $1`. The `locationService.js` has an `ensureUuid()` utility that can be reused.

### 4. Centralize Order Status Transitions
Use `validateOrderTransition()` to enforce valid state machine transitions. Never directly update `orders.status` without validation. Valid flow:
```
placed → accepted → preparing → ready_for_pickup → out_for_delivery → delivered
                                                                       → cancelled (any state)
```

### 5. Use CASCADE with Caution
Many CASCADE paths exist. Understand the full impact before issuing a DELETE. Use `SET NULL` for foreign keys where records should survive parent deletion (e.g., `delivery_partner_id` on orders).

### 6. Always Release Pool Connections
Every `pool.connect()` must have a corresponding `client.release()` in a `finally` block to prevent connection leaks.

### 7. Use Transactions for Multi-Table Writes
Every write affecting >1 table must use `BEGIN`/`COMMIT`/`ROLLBACK` pattern. Example: creating an order writes to both `orders` and `order_items`.

### 8. Rating Aggregation
Restaurant and rider ratings are computed from `rating_sum / rating_count`. These columns are denormalized and must be updated whenever a new rating is inserted. The aggregation queries in `ratings.js` handle this.

### 9. No PostgreSQL ENUM Types
All enums use VARCHAR columns with application-level constants. This means there's no DB-level constraint enforcement. Keep the app-layer constants in sync:
- Frontend: `src/lib/order-status.ts`
- Server: `server/src/modules/restaurantPanel/constants.js`

### 10. Checkpoint for Dev Endpoints
`/api/dev/delivery-count` and `/api/dev/test-orders` are accessible when `NODE_ENV !== 'production'`. Ensure production deployments set `NODE_ENV=production` to block these.
