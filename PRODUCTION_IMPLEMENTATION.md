# THINAVA - Production-Grade Real-Time Restaurant Operations Platform

## 🚀 Overview

THINAVA is a complete, production-ready real-time restaurant delivery operations platform built with Next.js 15, Node.js/Express, PostgreSQL, and Socket.IO. It enables restaurants, riders, and customers to interact seamlessly with real-time updates, live tracking, and comprehensive order management.

## ✨ Key Features

### 1. **Real-Time Restaurant Availability System**
- Restaurants can instantly change status: OPEN, TEMPORARILY_UNAVAILABLE, CLOSED
- Live status updates push to all customers without page refresh
- Real-time restaurant cards show status with animations
- Disable add-to-cart for unavailable restaurants

### 2. **Automated Rider Assignment & No Selection Screen**
- Admin/system can manually or auto-assign riders to orders
- If rider already assigned, customer directly sees rider details
- No rider selection screen when assignment is automatic
- Shows: Rider name, image, phone, vehicle type/number, live location, ETA

### 3. **Real-Time Rider Tracking**
- Live GPS location updates every 5 seconds
- Route rendering with distance and ETA calculations
- Animated rider marker on map
- Real-time speed and distance display
- Live ETA updates as rider approaches

### 4. **Order Rejection Popup System**
- Animated modal popup on order rejection
- Shows reason, refund information
- Immediate Socket.IO event trigger (no refresh needed)
- Call-to-action buttons: Retry Order or Go Home
- Auto-dismiss after 10 seconds

### 5. **Restaurant Authentication (Combined Signup/Login)**
- Single page with toggle between signup and login
- Restaurant registration collects: name, owner details, address, GST, FSSAI
- Location selection via Google Maps
- Status initially PENDING_APPROVAL
- Cannot login until admin approval

### 6. **Rider Authentication (Combined Signup/Login)**
- Single page with toggle for rider signup/login
- Collects: name, phone, vehicle details, zone information
- Aadhar and driving license upload support
- Status PENDING until admin approval
- Cannot access system before approval

### 7. **Admin Approval System**
- **Restaurants**: Approve, Reject, Suspend with notes
- **Riders**: Approve, Reject, Suspend with notes
- Real-time notifications via Socket.IO
- Admin can see pending applications
- Approval history logging

### 8. **Admin Manual Registration**
- Admin can manually add restaurants (bypass approval)
- Admin can manually add riders (auto-approved)
- Useful for partnerships and bulk onboarding

### 9. **Admin Menu Management System**
- Centralized menu categories (admin-controlled)
- Admin creates food items with base prices
- Restaurant maps admin items to their menu
- Restaurant can set custom prices and availability
- Admin can mark items as featured, trending, disabled

### 10. **Rider Active Order Lock**
- Rider cannot go offline with active order
- Rider cannot accept another order while in delivery
- Rider cannot logout with active delivery
- Warning popup if attempted
- Order lock released on delivery completion

### 11. **Complete Order Flow**
```
PLACED → CONFIRMED → PREPARING → READY_FOR_PICKUP → 
PICKED_UP → ON_THE_WAY → ARRIVING → DELIVERED
```

- Restaurant marks orders ready for pickup
- Shows only "Handover to assigned rider" button
- Rider marks as picked up (triggers "Order on the way" message)
- Live tracking displayed automatically
- Order completion unlocks rider

### 12. **Socket.IO Real-Time Events**
All events are emitted in real-time:
- `restaurantStatusUpdated` - Restaurant status changes
- `orderAssigned` - Order assigned to rider
- `orderAccepted` - Restaurant confirms order
- `orderRejected` - Order cancelled with popup
- `orderPickedUp` - Rider picked up order
- `orderDelivered` - Order delivered
- `riderLocationUpdated` - Live GPS updates
- `restaurantApproved` - Admin approves restaurant
- `restaurantRejected` - Admin rejects restaurant
- `riderApproved` - Admin approves rider
- `riderRejected` - Admin rejects rider

## 📁 Project Structure

### Backend (`/server`)
```
server/
├── src/
│   ├── routes/
│   │   ├── restaurant-auth.js      # Restaurant auth (signup/login)
│   │   ├── rider-auth.js           # Rider auth (signup/login)
│   │   ├── admin-extended.js       # Admin approvals & menu management
│   │   ├── orders-advanced.js      # Order management with real-time
│   │   └── ... (existing routes)
│   ├── database/
│   │   ├── schema-extensions.sql   # New tables for all features
│   │   ├── migrate-extensions.js   # Migration script
│   │   └── ... (existing schema)
│   ├── realtime/
│   │   ├── socketEventsHandler.js  # Central Socket.IO event handler
│   │   └── socketServer.js         # Socket.IO server setup
│   └── index.js                     # Main server file
└── package.json
```

### Frontend (`/src`)
```
src/
├── app/
│   ├── restaurant-auth/page.tsx    # Restaurant auth page
│   ├── rider-auth/page.tsx         # Rider auth page
│   └── ... (existing pages)
├── components/
│   ├── common/
│   │   ├── RestaurantStatus.tsx    # Status badge & card components
│   │   ├── RiderTracking.tsx       # Live tracking component
│   │   ├── OrderRejectionPopup.tsx # Rejection popup
│   │   └── ... (existing components)
│   └── ... (other components)
└── lib/
    └── ... (utilities)
```

## 🗄️ Database Tables

### New Tables Added

1. **restaurant_approvals** - Restaurant approval workflow
2. **delivery_partners** - Rider account management
3. **rider_details** - Vehicle, zone, shift information
4. **rider_approval_logs** - Rider approval history
5. **restaurant_status_logs** - Status change history
6. **restaurant_details** - Owner info, GST, FSSAI
7. **admin_menu_categories** - Admin-controlled menu categories
8. **admin_food_items** - Admin-controlled food items
9. **restaurant_menu_mappings** - Restaurant-specific pricing
10. **delivery_locations** - Real-time GPS tracking
11. **active_delivery_sessions** - Current active orders
12. **order_status_history** - Order tracking history
13. **socket_events_log** - Audit trail for real-time events

## 🛠️ Setup Instructions

### 1. Run Database Migrations

```bash
cd server
node src/database/migrate-extensions.js
```

This creates all new tables and indexes.

### 2. Set Environment Variables

```bash
# .env.local
RESTAURANT_JWT_SECRET=your-restaurant-secret-key
DELIVERY_JWT_SECRET=your-delivery-secret-key
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://...
```

### 3. Install Dependencies

```bash
npm install
cd server && npm install
```

### 4. Start Development Servers

```bash
# From root directory
npm run dev

# Or separately:
npm run dev:frontend  # Terminal 1
npm run dev:backend   # Terminal 2
```

## 🔌 API Endpoints

### Restaurant Authentication
- `POST /api/restaurant-auth/register` - Register restaurant
- `POST /api/restaurant-auth/login` - Login restaurant
- `GET /api/restaurant-auth/profile` - Get restaurant profile
- `POST /api/restaurant-auth/status/update` - Change status
- `GET /api/restaurant-auth/status/:restaurantId` - Get status

### Rider Authentication
- `POST /api/rider-auth/register` - Register rider
- `POST /api/rider-auth/login` - Login rider
- `GET /api/rider-auth/profile` - Get rider profile
- `POST /api/rider-auth/online-status` - Set online/offline
- `POST /api/rider-auth/location` - Update location
- `POST /api/rider-auth/logout` - Logout

### Admin Extended
- `GET /api/admin-extended/restaurants/pending` - Get pending restaurants
- `POST /api/admin-extended/restaurants/:id/approve` - Approve restaurant
- `POST /api/admin-extended/restaurants/:id/reject` - Reject restaurant
- `GET /api/admin-extended/riders/pending` - Get pending riders
- `POST /api/admin-extended/riders/:id/approve` - Approve rider
- `POST /api/admin-extended/riders/:id/reject` - Reject rider
- `POST /api/admin-extended/restaurants/register-manual` - Manual restaurant registration
- `POST /api/admin-extended/riders/register-manual` - Manual rider registration
- `POST /api/admin-extended/menu/category/create` - Create menu category
- `POST /api/admin-extended/menu/item/create` - Create food item

### Orders Advanced
- `POST /api/orders-advanced/create` - Create order
- `POST /api/orders-advanced/:id/assign-rider` - Assign rider
- `POST /api/orders-advanced/:id/reject` - Reject order
- `POST /api/orders-advanced/:id/accept` - Accept order
- `POST /api/orders-advanced/:id/ready-for-pickup` - Mark ready
- `POST /api/orders-advanced/:id/picked-up` - Mark picked up
- `POST /api/orders-advanced/:id/delivered` - Mark delivered
- `GET /api/orders-advanced/rider/:riderId/active` - Get active order

## 📱 Frontend Components

### RestaurantStatus.tsx
```typescript
<RestaurantStatusBadge status="OPEN" /> // Show status badge
<RestaurantCardWithStatus {...props} /> // Restaurant card with status
<RestaurantStatusControl {...props} /> // Admin status control
```

### RiderTracking.tsx
```typescript
<RiderTrackingCard {...props} /> // Show rider tracking
<RiderActiveOrderBanner {...props} /> // Active order banner
```

### OrderRejectionPopup.tsx
```typescript
<OrderRejectionPopup isOpen={true} {...props} /> // Rejection popup
```

## 🔐 Authentication

### Restaurant JWT Payload
```json
{
  "restaurantUserId": "uuid",
  "restaurantId": "uuid",
  "email": "owner@restaurant.com",
  "fullName": "Owner Name"
}
```

### Rider JWT Payload
```json
{
  "id": "uuid",
  "phone": "1234567890",
  "fullName": "Rider Name"
}
```

## 🎯 Socket.IO Implementation

### Subscribe to Real-Time Events (Client)

```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: authToken,
    role: 'customer' // or 'restaurant', 'delivery_partner', 'admin'
  }
})

socket.emit('session:subscribe', {
  role: 'customer',
  token: authToken
}, (response) => {
  console.log('Subscribed to rooms:', response.rooms)
})

// Listen to events
socket.on('restaurantStatusUpdated', (data) => {
  console.log('Restaurant status changed:', data)
})

socket.on('orderRejected', (data) => {
  // Show rejection popup
})
```

### Emit Events (Server)

```javascript
const handler = new SocketEventsHandler(io)

// Restaurant status updated
await handler.emitRestaurantStatusUpdated(restaurantId, 'OPEN')

// Order rejected (shows popup)
await handler.emitOrderRejected(orderId, { userId }, 'Out of stock')

// Rider location
await handler.emitRiderLocationUpdated(riderId, orderId, lat, lon)
```

## 🎨 UI/UX Design

- **Theme**: Premium modern with orange gradients
- **Background**: Deep navy (#000A22) with glassmorphism
- **Accents**: Orange gradient (orange-500 to orange-600)
- **Components**: Smooth transitions, animations with Framer Motion
- **Responsiveness**: Mobile-first, fully responsive

## ⚡ Performance Optimizations

- Realtime updates via Socket.IO (no polling)
- Database indexing on frequently queried columns
- JWT token-based auth (stateless)
- Connection pooling for database
- Rate limiting on critical endpoints
- Compressed socket events

## 🔄 Real-Time Flow Example

### Order Rejection Example:
1. Restaurant marks order as rejected
2. API validates and updates database
3. Socket event `orderRejected` emitted to customer room
4. Frontend receives event and triggers rejection popup animation
5. Popup shows reason and refund info
6. User can retry or go home (all without page refresh)

### Restaurant Status Change Example:
1. Restaurant owner clicks status button
2. API updates restaurant.status in database
3. Socket event emitted to:
   - Admin room (monitoring)
   - All customer connections (for filtering)
   - Specific restaurant room (confirmation)
4. Customer app refreshes restaurant cards in real-time
5. Unavailable restaurants show grayed out or hidden

## 📊 Scalability Considerations

- Socket.IO rooms for targeted broadcasting
- Database partitioning for large order volumes
- Caching for frequently accessed data
- Load balancing for multiple server instances
- CDN for static assets and media

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis (optional, for Socket.IO adapters)

### Production Checklist
- [ ] Set strong JWT secrets in environment
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domain
- [ ] Set up database backups
- [ ] Enable rate limiting
- [ ] Configure Sentry/error tracking
- [ ] Set up monitoring and alerts
- [ ] Test all Socket.IO connections
- [ ] Verify email notifications

## 📝 License

© 2024 THINAVA. All rights reserved.

---

## 🆘 Support

For issues or questions about this implementation, refer to the inline code comments and TypeScript types for full API documentation.
