# Restaurant Onboarding - Quick Start Guide

## System Overview

THINAVA has successfully transitioned from a test dashboard to a **production-grade restaurant partner system**. Here's everything you need to know:

## Key Features Implemented ✅

### 1. Removed Test/Demo System
- ❌ No more hardcoded "ibbus@thinava.com" credentials
- ❌ No demo login message on restaurant login page
- ✅ All restaurants must go through real approval workflow

### 2. Professional Authentication System
- **Premium UI**: Dark navy + orange gradients, glassmorphic design
- **Comprehensive Signup**: All business details captured
- **Approval Workflow**: PENDING_APPROVAL → Admin Review → OPEN
- **Real-time Notifications**: Socket.IO updates on approval

### 3. Admin Approval Dashboard
- View pending restaurant applications
- See full restaurant details (location, hours, documents)
- Approve or reject with one click
- Real-time notifications sent to restaurants

## Quick Testing Steps

### Step 1: Register a Restaurant

**URL**: `http://localhost:3000/restaurant-auth`

**Click**: "Create Account" tab

**Fill Form**:
```
Restaurant Name: Test Restaurant
Owner Name: John Owner
Phone: 9876543210
Email: test@restaurant.com
Address: 123 Main Street
City: Hyderabad
State: Telangana
Pincode: 500001
Category: North Indian
Veg/Non-Veg: Both
Opening Time: 10:00
Closing Time: 22:00
Delivery Radius: 5 km
Password: Test@123
Confirm: Test@123
```

**Click**: "Register Restaurant"

### Step 2: See Approval Waiting Screen

After submitting, you should see:
- ⏳ "Verification in Progress" title
- ⏱️ Animated clock icon
- 📧 Your email address displayed
- 📞 "Call Support: 9160776152" button
- ✅ Expected time: 24-48 hours

### Step 3: Admin Approves Restaurant

**URL**: `http://localhost:3000/admin/approvals`

**Click**: "Restaurants" tab (should show your submitted restaurant)

**View Restaurant Details**:
- Owner info (name, phone, email)
- Location (address, city, state, pincode)
- Business info (category, type, hours, radius)
- Documents (if filed)

**Click**: "✅ Approve" button

### Step 4: Real-Time Notification

✨ **Real-time Magic**: Without page refresh:
- Browser notification appears (Socket.IO)
- Approval status updates live
- Restaurant owner sees success message

### Step 5: Login Now Works

**URL**: `http://localhost:3000/restaurant/login` or `/restaurant-auth`

**Click**: "Sign In" tab

**Use Credentials**:
```
Email: test@restaurant.com
Password: Test@123
```

**Click**: "Enter Dashboard"

✅ **Success!** You're now in the restaurant dashboard

## What Each Component Does

### Restaurant Auth Page (`/restaurant-auth`)

**Left Side**:
- Hero section with premium design
- Animated stats (500+ restaurants, 50k daily orders, 98% uptime)
- Feature cards (Analytics, Menu Management, Support, Multi-location)

**Right Side**:
- Sign In form (email + password)
- Create Account form (comprehensive signup)
- Support phone button

**Key Behavior**:
- After signup → Shows PENDING_APPROVAL waiting screen
- After approval → Can login normally

### Admin Approvals Dashboard (`/admin/approvals`)

**Restaurant Tab**:
- Lists all pending restaurants
- Shows complete details in organized cards
- Approve/Reject buttons
- Real-time status updates

**Manual Entry Tab**:
- Admin can manually create restaurants
- Auto-approved (no waiting)
- Useful for direct onboarding

### Restaurant Dashboard (`/restaurant/dashboard`)

**Access Rules**:
- ✅ Only approved restaurants can access
- ❌ PENDING_APPROVAL → blocked (waiting screen)
- ❌ REJECTED → shows rejection reason
- ❌ SUSPENDED → shows suspension notice

## Support Integration

### Support Phone: 9160776152

**Appears in**:
- ✅ Restaurant login page (blue info box)
- ✅ Approval waiting screen (support button)
- ✅ Admin panels (contact info)
- ✅ Dashboard help sections

**Format**: `tel:9160776152` - Clicking calls directly

## Database Records Created

When you signup and get approved, these records are created:

```
restaurants
├── name: "Test Restaurant"
├── status: "PENDING_APPROVAL" (then "OPEN")
├── category: "north-indian"
├── opening_time: "10:00"
├── closing_time: "22:00"
└── ...

restaurant_details
├── owner_name: "John Owner"
├── owner_phone: "9876543210"
├── owner_email: "test@restaurant.com"
├── address: "123 Main Street"
├── city: "Hyderabad"
└── ...

restaurant_approvals
├── status: "PENDING" → "APPROVED"
├── restaurant_id: 123
├── owner_name: "John Owner"
└── ...

restaurant_users
├── email: "test@restaurant.com"
├── password_hash: (bcrypted)
├── full_name: "John Owner"
├── phone: "9876543210"
└── ...

restaurant_approval_history
├── action: "SUBMITTED"
├── restaurant_id: 123
└── created_at: (timestamp)
```

## API Endpoints

### Public Endpoints

```bash
# Register restaurant
POST /api/restaurant-auth/register
Body: {
  restaurantName, ownerName, ownerPhone, ownerEmail, password, confirmPassword,
  address, city, state, pincode, category, vegNonVeg,
  openingTime, closingTime, deliveryRadius,
  gstNumber, fssaiLicense
}

# Login
POST /api/restaurant-auth/login
Body: { email, password }
Response: { success, token, user }
```

### Protected Endpoints (need JWT token)

```bash
# Get profile
GET /api/restaurant-auth/profile
Header: Authorization: Bearer {token}

# Update status
POST /api/restaurant-auth/status/update
Header: Authorization: Bearer {token}
Body: { status, reason }
```

### Admin Endpoints

```bash
# Get pending
GET /api/admin/restaurants/pending

# Approve
POST /api/admin/restaurants/{id}/approve
Body: { notes, approvedByAdminId }

# Reject
POST /api/admin/restaurants/{id}/reject
Body: { rejectionReason, rejectedByAdminId }
```

## Testing Scenarios

### Scenario 1: Happy Path
1. Signup ✅
2. Wait for approval ✅
3. Admin approves ✅
4. Login ✅
5. Dashboard loads ✅

### Scenario 2: Duplicate Prevention
1. Signup with email "test@abc.com" ✅
2. Try signup again with same email ❌ → Error: "Email already registered"
3. Try signup with same phone ❌ → Error: "Phone already registered"

### Scenario 3: Validation
1. Try signup without restaurant name ❌ → Error: "Missing required fields"
2. Try invalid email (no @ symbol) ❌ → Error: "Invalid email format"
3. Try 5-digit phone ❌ → Error: "Invalid phone number"
4. Try password with 3 chars ❌ → Error: "Password min 6 chars"
5. Try mismatched passwords ❌ → Error: "Passwords do not match"

### Scenario 4: Approval Workflow
1. Signup ✅ → Status: PENDING_APPROVAL
2. Try login ❌ → Error: "Restaurant pending approval" + waiting screen
3. Admin approves ✅ → Status: OPEN
4. Now login works ✅

### Scenario 5: Rejection
1. Signup ✅
2. Admin rejects with reason ✅
3. Restaurant owner sees rejection ✅
4. Can edit and resubmit ✅

## Security Features

✅ **Password Security**
- Bcrypt hashing (10 rounds)
- Min 6 characters
- Confirmation validation

✅ **Data Validation**
- Email format validation
- Phone number validation (10 digits)
- Required field checking

✅ **Uniqueness Checks**
- Email must be unique
- Phone must be unique
- Restaurant name must be unique

✅ **JWT Authentication**
- 7-day token expiry
- Token refresh on login
- Secure token storage

✅ **Approval Workflow**
- No default access (TEST MODE REMOVED)
- Admin must explicitly approve
- Real-time notifications

✅ **Rate Limiting** (TODO)
- Max 5 login attempts per 15 min
- Max 3 signups per phone per day
- IP-based throttling

## Troubleshooting

### Problem: Signup successful but can't login
**Solution**: Status is PENDING_APPROVAL. Go to admin panel and approve the restaurant.

### Problem: See "Verification in Progress" forever
**Solution**: Restaurant not approved yet. Admin needs to visit `/admin/approvals` and approve it.

### Problem: Invalid email error
**Solution**: Email has spaces or special characters. Check format.

### Problem: Support button doesn't work
**Solution**: Make sure URL is `tel:9160776152`. Your phone should open dialer.

### Problem: Real-time updates not appearing
**Solution**: Check Socket.IO connection in browser console. Refresh page as fallback.

## Performance Metrics

Expected response times:
- **Signup**: < 2 seconds
- **Login**: < 1 second
- **Admin approval**: < 1 second
- **Socket notification**: < 100ms

Database queries are indexed on:
- email (restaurant_users)
- phone (restaurant_users)
- status (restaurants)
- restaurant_id (restaurant_approvals)

## Environment Setup

```env
# .env.local or server/.env
RESTAURANT_JWT_SECRET=your-production-secret-key-here
SOCKET_ENABLED=true
SUPPORT_PHONE=9160776152
```

## Browser Compatibility

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ Mobile browsers (iOS Safari, Chrome Android)

## Next Steps

1. ✅ **Test the flow** - Follow steps above
2. ✅ **Create sample data** - Signup 2-3 test restaurants
3. ✅ **Admin approval** - Test approve/reject workflow
4. ✅ **Dashboard access** - Verify approved restaurants can login
5. 📋 **Load testing** - Test with 100+ concurrent signups
6. 📋 **Security audit** - Review rate limiting and validation
7. 📋 **Email notifications** - Add email on approval/rejection
8. 📋 **Document uploads** - Add restaurant logo, FSSAI certificate upload

## Support

📞 **Hotline**: 9160776152
📧 **Email**: support@thinava.com  
🌐 **Website**: https://thinava.com

---

**Version**: 1.0 (Production Ready)  
**Last Updated**: May 21, 2026  
**Status**: ✅ Ready for Testing & Deployment
