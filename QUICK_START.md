# THINAVA - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Run Database Migration

```bash
cd server
node src/database/migrate-extensions.js
```

**Expected Output:**
```
✓ Schema extensions applied successfully
✓ All tables verified successfully
✓ THINAVA Database Migration Complete!
```

### 2. Start Development Servers

**Terminal 1 - Frontend:**
```bash
npm run dev:frontend
# or
npm run frontend
```

**Terminal 2 - Backend:**
```bash
npm run dev:backend
# or
npm run backend
```

**Terminal 3 - Both (Optional):**
```bash
npm run dev
```

### 3. Access the Application

| Role | URL | Port |
|------|-----|------|
| Customer | http://localhost:3000 | 3000 |
| Restaurant Auth | http://localhost:3000/restaurant-auth | 3000 |
| Rider Auth | http://localhost:3000/rider-auth | 3000 |
| Admin Panel | http://localhost:3000/admin | 3000 |
| API Server | http://localhost:5000 | 5000 |

---

## 📝 Test Data Setup

### 1. Create a Restaurant

**Endpoint:** `POST /api/restaurant-auth/register`

```bash
curl -X POST http://localhost:5000/api/restaurant-auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Test Restaurant",
    "ownerName": "John Doe",
    "ownerPhone": "9876543210",
    "ownerEmail": "restaurant@test.com",
    "password": "password123",
    "confirmPassword": "password123",
    "address": "123 Main St, City",
    "latitude": 17.3850,
    "longitude": 78.4867,
    "cuisines": ["North Indian", "Chinese"]
  }'
```

### 2. Approve Restaurant (Admin)

**Endpoint:** `POST /api/admin-extended/restaurants/{restaurantId}/approve`

```bash
curl -X POST http://localhost:5000/api/admin-extended/restaurants/{restaurantId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Approved by admin"
  }'
```

### 3. Login as Restaurant

**Endpoint:** `POST /api/restaurant-auth/login`

```bash
curl -X POST http://localhost:5000/api/restaurant-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@test.com",
    "password": "password123"
  }'
```

**Response includes JWT token for subsequent requests:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "restaurantId": "uuid",
    "email": "restaurant@test.com"
  }
}
```

### 4. Change Restaurant Status

**Endpoint:** `POST /api/restaurant-auth/status/update`

```bash
curl -X POST http://localhost:5000/api/restaurant-auth/status/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "status": "OPEN",
    "reason": "Opening for lunch"
  }'
```

### 5. Create a Rider

**Endpoint:** `POST /api/rider-auth/register`

```bash
curl -X POST http://localhost:5000/api/rider-auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Delivery Boy",
    "phone": "9876543211",
    "email": "rider@test.com",
    "password": "password123",
    "confirmPassword": "password123",
    "vehicleType": "BIKE",
    "vehicleNumber": "TG11AB1234",
    "zone": "North"
  }'
```

### 6. Approve Rider (Admin)

**Endpoint:** `POST /api/admin-extended/riders/{riderId}/approve`

```bash
curl -X POST http://localhost:5000/api/admin-extended/riders/{riderId}/approve
```

---

## 🔌 Real-Time Testing

### Connect to Socket.IO

```javascript
// Browser Console or Node.js
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token',
    role: 'customer' // 'restaurant', 'delivery_partner', 'admin'
  }
});

socket.emit('session:subscribe', {
  role: 'customer',
  token: 'your-jwt-token'
}, (response) => {
  console.log('Connected to rooms:', response.rooms);
});

// Listen to events
socket.on('restaurantStatusUpdated', (data) => {
  console.log('Restaurant status changed:', data);
});

socket.on('orderRejected', (data) => {
  console.log('Order rejected:', data);
});
```

---

## 📱 Key Workflows

### Workflow 1: Order Rejection with Popup

1. Customer places order
2. Restaurant rejects order
3. Socket event `orderRejected` emitted
4. **Popup appears instantly** (no refresh needed)
5. Shows reason, refund info, retry button

### Workflow 2: Real-Time Rider Tracking

1. Order assigned to rider
2. Rider starts delivery
3. Location updates every 5 seconds
4. Socket event `riderLocationUpdated` emitted
5. Customer sees **live map** with distance/ETA

### Workflow 3: Restaurant Status Change

1. Restaurant owner changes status to "TEMPORARILY_UNAVAILABLE"
2. Socket event `restaurantStatusUpdated` emitted
3. All customer apps see **greyed-out restaurant card**
4. Cannot place order
5. No page refresh needed

### Workflow 4: Rider Active Order Lock

1. Rider accepts delivery order
2. Rider tries to go offline
3. **Warning popup** appears
4. Cannot logout until delivery completes
5. Order marked delivered → lock released

---

## 🛠️ Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
psql -U postgres -d thinava

# Check DATABASE_URL in .env.local
cat .env.local | grep DATABASE_URL

# Verify migrations ran
node server/src/database/migrate-extensions.js
```

### Socket.IO Connection Issues

```bash
# Check backend is running on port 5000
curl http://localhost:5000/api/health

# Verify CORS in .env.local
FRONTEND_URL=http://localhost:3000

# Check Socket.IO logs
# Should show connection messages
```

### JWT Token Expired

```bash
# Get new token by logging in again
curl -X POST http://localhost:5000/api/restaurant-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'

# Store new token in localStorage
localStorage.setItem('restaurantToken', 'new-token')
```

---

## 📊 Database Commands

### Check Tables Created

```bash
psql -U postgres -d thinava -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema='public' 
  ORDER BY table_name;"
```

### View Restaurant Approvals

```bash
psql -U postgres -d thinava -c "
  SELECT id, owner_name, status, created_at 
  FROM restaurant_approvals;"
```

### View Pending Riders

```bash
psql -U postgres -d thinava -c "
  SELECT full_name, phone, approval_status, created_at 
  FROM delivery_partners;"
```

### View Real-Time Events

```bash
psql -U postgres -d thinava -c "
  SELECT event_name, subject_id, created_at 
  FROM socket_events_log 
  ORDER BY created_at DESC LIMIT 10;"
```

---

## 🚀 Deployment Checklist

- [ ] Run database migrations
- [ ] Set environment variables
- [ ] Test restaurant registration → approval → login
- [ ] Test rider registration → approval → login
- [ ] Test order creation and rejection (check popup)
- [ ] Test real-time location updates
- [ ] Test Socket.IO events in browser console
- [ ] Test admin approvals
- [ ] Test menu management
- [ ] Verify all endpoints respond
- [ ] Check CORS configuration
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts

---

## 📞 API Reference Quick Links

| Feature | Endpoint | Method |
|---------|----------|--------|
| Register Restaurant | `/api/restaurant-auth/register` | POST |
| Login Restaurant | `/api/restaurant-auth/login` | POST |
| Change Status | `/api/restaurant-auth/status/update` | POST |
| Register Rider | `/api/rider-auth/register` | POST |
| Login Rider | `/api/rider-auth/login` | POST |
| Update Location | `/api/rider-auth/location` | POST |
| Approve Restaurant | `/api/admin-extended/restaurants/:id/approve` | POST |
| Reject Restaurant | `/api/admin-extended/restaurants/:id/reject` | POST |
| Approve Rider | `/api/admin-extended/riders/:id/approve` | POST |
| Reject Rider | `/api/admin-extended/riders/:id/reject` | POST |
| Create Order | `/api/orders-advanced/create` | POST |
| Assign Rider | `/api/orders-advanced/:id/assign-rider` | POST |
| Reject Order | `/api/orders-advanced/:id/reject` | POST |
| Mark Ready | `/api/orders-advanced/:id/ready-for-pickup` | POST |
| Mark Delivered | `/api/orders-advanced/:id/delivered` | POST |

---

## 💡 Tips & Tricks

1. **Test Socket Events in Browser:**
   - Open DevTools Console
   - Connect to Socket.IO
   - Emit events from another terminal/device
   - Watch real-time updates

2. **Database Queries:**
   - Use `EXPLAIN ANALYZE` for slow queries
   - Check indexes with `\di`
   - Monitor slow query log

3. **Performance:**
   - Keep Socket.IO rooms organized
   - Use selective broadcasting
   - Implement database connection pooling
   - Cache frequently accessed data

4. **Debugging:**
   - Enable SQL logging: `process.env.DEBUG = 'sql'`
   - Check Socket.IO adapter logs
   - Monitor database connections
   - Use Browser DevTools Network tab

---

## 📖 Full Documentation

- See `/PRODUCTION_IMPLEMENTATION.md` for complete API docs
- See `/IMPLEMENTATION_COMPLETE.md` for technical details
- See individual component files for TypeScript types

---

**🎉 THINAVA is ready to run! Start with `npm run dev` 🎉**
