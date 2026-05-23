# Thinava Delivery System - Quick Start Guide

Get the delivery partner system running in 5 minutes!

## Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git

## ⚡ Quick Setup

### 1. Backend Setup (5 minutes)

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create .env.local from example
cp .env.example .env.local

# Edit .env.local with your database URL
# DATABASE_URL=postgresql://user:password@localhost/thinava

# Start the server
npm start
```

**What happens automatically:**
✓ Database tables created (delivery_partners, delivery_assignments, etc.)
✓ Migrations run automatically
✓ Server listens on http://localhost:5000
✓ Health check available at http://localhost:5000/health

### 2. Frontend Setup (3 minutes)

```bash
# In project root (THINAVA)
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key-here
EOF

# Start development server
npm run dev
```

**Frontend runs at:** http://localhost:3000

### 3. Access Delivery System

1. Open browser: http://localhost:3000/delivery/login
2. Use demo credentials:
   - Phone: **9876543210**
   - Password: **demo123**
3. You're in! 🎉

## 🧪 Test the Full Flow

### Step 1: Dashboard
- ✓ See online/offline toggle
- ✓ See today's earnings (starts at ₹0)
- ✓ View quick action cards

### Step 2: Accept Order
- Click "Available Orders"
- Accept a test order
- Redirected to active delivery tracking

### Step 3: Update Delivery Status
- Click status buttons in sequence:
  - "Reached Restaurant"
  - "Picked Up"
  - "On The Way"
  - "Delivered"
- Watch earnings update

### Step 4: View Earnings
- Click "Earnings" from dashboard
- See today/week/month totals
- View delivery history

### Step 5: Check Profile
- Click "Profile" (top right)
- See partner information
- View vehicle details
- Check document status

## 📝 Demo Accounts

### Delivery Partner
- Phone: 9876543210
- Password: demo123
- Status: Active, ready to deliver

## 🗄️ Database Schema

Key tables created automatically:
```
delivery_partners     - Partner profiles
delivery_assignments  - Order assignments
delivery_locations    - GPS tracking
delivery_status_logs  - Status history
delivery_earnings     - Earnings records
```

**Orders table extended with:**
- delivery_partner_id
- delivery_status
- delivery_assigned_at
- picked_up_at
- delivered_at

## 🔑 Environment Variables

### Required
```
DATABASE_URL=postgresql://user:pass@localhost/thinava
JWT_SECRET=your-jwt-secret-key
DELIVERY_JWT_SECRET=your-delivery-secret-key
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Optional
```
GOOGLE_MAPS_API_KEY=for-maps-integration
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## 🐛 Troubleshooting

### "Cannot find database"
```
# Check PostgreSQL is running
# Windows: services.msc → PostgreSQL
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### "Port 5000 already in use"
```bash
# Use different port
PORT=5001 npm start
```

### "NEXT_PUBLIC_API_URL not set"
```bash
# Ensure .env.local is in project root with:
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### "Google Maps not showing"
```
# API key needed for maps integration
# For now, maps show demo coordinates
# Add your key in .env.local for production
```

## 📁 Project Structure

```
THINAVA/
├── server/                        # Backend
│   └── src/modules/delivery/      # Delivery system
│       ├── services/              # Business logic
│       ├── controllers/           # API handlers
│       ├── routes/                # Endpoints
│       └── middleware/            # Auth, validation
│
├── src/
│   ├── app/delivery/              # Frontend pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── active-order/
│   │   ├── earnings/
│   │   └── profile/
│   ├── lib/delivery-api.ts        # API client
│   ├── store/                     # Zustand stores
│   └── types/delivery.ts          # TypeScript types
│
└── .env.local                     # Environment vars
```

## 🚀 API Endpoints Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/delivery/auth/register | Sign up |
| POST | /api/delivery/auth/login | Login |
| GET | /api/delivery/orders | Available orders |
| POST | /api/delivery/orders/accept | Accept order |
| GET | /api/delivery/orders/active | Current delivery |
| POST | /api/delivery/orders/status | Update status |
| POST | /api/delivery/location | Save GPS location |
| GET | /api/delivery/earnings/today | Today earnings |

## 💡 Common Tasks

### Register New Partner
```
POST /api/delivery/auth/register
{
  "full_name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "password": "password123",
  "vehicle_type": "bike",
  "vehicle_number": "AP 1234 AB 1234"
}
```

### Accept Order
```
POST /api/delivery/orders/accept
{
  "order_id": "order-123"
}
```

### Update Delivery Status
```
POST /api/delivery/orders/status
{
  "order_id": "order-123",
  "status": "PICKED_UP",
  "latitude": 12.9352,
  "longitude": 77.6245
}
```

## 🧬 Generate Test Data

**Coming soon:** Script to generate demo delivery partners and test orders

```bash
# Future command to seed data
npm run seed:delivery
```

## 📊 Monitoring

### Check System Health
```bash
# Backend health
curl http://localhost:5000/health

# Database connection
curl http://localhost:5000/api/delivery/auth/profile \
  -H "Authorization: Bearer <token>"
```

### View Logs
```bash
# Backend logs show in console
# Frontend logs in browser console (F12)
```

## 🔐 Security Notes

- JWT tokens expire after 7 days
- Passwords hashed with bcryptjs
- Authentication required for all delivery endpoints
- CORS configured for frontend domain
- Location data only visible to authenticated partners

## 🎯 Next Steps

1. **Test with Backend**: Make API calls, verify responses
2. **Test with Database**: Check data persistence
3. **Integration**: Connect to customer app
4. **Testing**: Run full order-to-delivery flow
5. **Deployment**: Deploy to staging/production

## 📚 Documentation

- [DELIVERY_SYSTEM_README.md](./DELIVERY_SYSTEM_README.md) - Complete documentation
- [DELIVERY_INTEGRATION_GUIDE.md](./DELIVERY_INTEGRATION_GUIDE.md) - Integration with existing systems

## 💬 Need Help?

1. Check logs: Backend console or browser console (F12)
2. Verify env vars: `echo $DATABASE_URL` (Linux/Mac) or `echo %DATABASE_URL%` (Windows)
3. Check database: `psql -c "SELECT * FROM delivery_partners;"`
4. Restart services: Stop server, run `npm start` again

## 🎓 Learning Path

1. **Day 1**: Get system running ✓
2. **Day 2**: Register new partner, explore dashboard
3. **Day 3**: Accept order, update status, track earnings
4. **Day 4**: Integrate with customer app
5. **Day 5**: Test full order flow

## ✨ Features Summary

✓ Multi-step registration
✓ JWT authentication
✓ Available orders list
✓ Real-time status updates
✓ GPS location tracking
✓ Earnings analytics
✓ Profile management
✓ Online/offline toggle
✓ Mobile responsive
✓ Smooth animations

## 🚀 Performance Tips

- Orders refresh every 10 seconds (adjustable)
- Location updates every 5 seconds (adjustable)
- Earnings cached for 1 hour
- Minimal database queries
- Optimized API responses

## 📈 Scaling Ready

- Database indexes on all foreign keys
- Pagination for history endpoints
- Atomic transactions for consistency
- Connection pooling configured
- Ready for production deployment

---

**Happy Delivering! 🚴‍♂️**

For detailed information, see [DELIVERY_SYSTEM_README.md](./DELIVERY_SYSTEM_README.md)
