# THINAVA - Production Restaurant Onboarding System

## Overview

The THINAVA restaurant onboarding system has been completely converted from a test/demo system into a **production-grade restaurant partner platform** similar to Swiggy Partner, Zomato Partner, and Uber Eats Merchant.

## Key Changes

### ✅ Removed Test/Demo Behavior
- ❌ Removed hardcoded merchant accounts
- ❌ Removed demo credentials message from restaurant login page
- ❌ Removed default restaurant fallback login
- ❌ Removed fake auth flow
- ✅ All authentication now uses real database records with JWT

### ✅ Professional Restaurant Authentication Page

**Location**: `/restaurant-auth`

**Features**:
- Premium hero section with animated statistics
- Modern animated tab switch between Sign In and Create Account
- Professional enterprise UI with dark navy and orange gradients
- Approval waiting screen with animated clock icon
- Support phone button throughout the flow

**Design Elements**:
- Glassmorphic cards with backdrop blur
- Gradient borders and shadows
- Smooth transitions and animations
- Mobile responsive layout
- Professional typography

## Restaurant Signup Flow

### Step 1: Comprehensive Registration Form

Users fill out detailed restaurant information across multiple sections:

#### Business Details
- Restaurant name (required)
- Owner full name (required)
- Mobile number (required, unique)
- Email address (required, unique)
- Restaurant category (dropdown)
- Password (min 6 characters)
- Confirm password

#### Location Details
- Full address (required)
- City (required)
- State (required)
- Pincode (required)
- Latitude / Longitude (auto-filled from map picker if available)

#### Operations
- Opening time
- Closing time
- Veg / Non-Veg type (Vegetarian, Non-Vegetarian, Both)
- Delivery radius (0.5 - 30 km)

#### Documents (Optional)
- GST Number
- FSSAI License

### Step 2: Account Created in PENDING_APPROVAL Status

After signup:
1. Restaurant record created with status: `PENDING_APPROVAL`
2. Restaurant details stored with full information
3. Approval request created for admin review
4. Restaurant user account created with hashed password
5. Approval history logged

**Database Records Created**:
- `restaurants` - Main restaurant record
- `restaurant_details` - Full owner and business details
- `restaurant_approvals` - Approval request record
- `restaurant_users` - User account with hashed password
- `restaurant_approval_history` - Audit trail

### Step 3: Approval Waiting Screen

Restaurant owner sees a beautiful waiting screen with:
- "Verification in Progress" title
- Animated clock icon
- Email address confirmation
- Expected approval time: 24-48 hours
- Support phone button (tel: 9160776152)
- Options to go home or call support

**User Cannot Login** until approved. If they try to login while PENDING_APPROVAL:
- API returns 403 status with `PENDING_APPROVAL` status
- Frontend shows the approval waiting screen
- No dashboard access possible

## Admin Approval System

### Location: `/admin/approvals`

### Features

**Restaurant Approval Queue**:
- Lists all pending restaurant applications
- Shows complete restaurant details:
  - Owner name, phone, email
  - Location (address, city, state, pincode, coordinates)
  - Business info (category, veg/non-veg, operating hours, delivery radius)
  - Documents filed (GST, FSSAI if provided)
  - Application date

**Admin Actions**:
- ✅ **Approve** - Instantly activates restaurant account
- ❌ **Reject** - Sends rejection notification to restaurant owner

### Approval Logic

**When Admin Approves**:
1. Restaurant status changed from `PENDING_APPROVAL` → `OPEN`
2. Restaurant approval record updated with approval notes and timestamp
3. Approval history logged
4. **Real-time notification sent via Socket.IO**:
   - Message to restaurant owner: "Your restaurant has been approved!"
   - Message to admin: Confirmation of approval

**When Admin Rejects**:
1. Restaurant status changed to `REJECTED`
2. Rejection reason stored
3. Rejection history logged
4. **Real-time notification sent via Socket.IO**:
   - Message to restaurant owner with rejection reason
   - Restaurant owner can edit and resubmit

### Manual Restaurant Creation

Admins can manually create restaurants via the admin panel:
- Restaurant auto-approved and can login immediately
- Useful for onboarding partners who prefer direct contact
- Created restaurants bypass approval workflow

## Real-Time Status Updates

### Socket.IO Events

When admin approves or rejects a restaurant, real-time notifications are sent:

**Events Emitted**:
- `restaurantApproved` - Sent to restaurant and admin
- `restaurantRejected` - Sent to restaurant and admin
- `restaurantStatusUpdated` - Sent when restaurant changes operational status

**Channels**:
- `restaurant:{restaurantId}` - Individual restaurant channel
- `admin:global` - All admin global events

**Implementation**:
The Socket.IO integration means restaurant owners see approval/rejection:
- ✅ Instantly without page refresh
- ✅ With animated notifications
- ✅ In real-time across all tabs/devices

## Authentication & Security

### JWT Authentication

**Token Details**:
- Secret: `RESTAURANT_JWT_SECRET` (from environment)
- Expiry: 7 days
- Contains: `restaurantUserId`, `restaurantId`, `email`, `fullName`

**Implementation**:
- Tokens stored in localStorage on client
- Tokens verified on every protected API call
- Middleware `authenticateRestaurant` validates tokens

### Password Security

- Passwords hashed with bcrypt (salt rounds: 10)
- Minimum 6 characters required
- Confirmation password validation
- No plaintext password storage

### Validation

**Email**:
- Format validation (must be valid email)
- Uniqueness check across restaurant_users table
- Case-insensitive lookup

**Phone**:
- 10-digit validation (removes non-numeric chars)
- Uniqueness check across restaurant_users table
- Valid Indian phone format

**Duplicates**:
- Restaurant name uniqueness check
- Email uniqueness check
- Phone number uniqueness check
- Returns 409 Conflict on duplicate

### Rate Limiting

(To be implemented) - Endpoints should have rate limiting to prevent:
- Brute force attacks on login
- Mass signup attempts
- Spam registrations

### Protected Routes

**Restaurant Dashboard Routes** (`/restaurant/*`):
- Require valid JWT token
- Verify restaurant status is `OPEN`
- Reject access if status is `PENDING_APPROVAL`, `REJECTED`, or `SUSPENDED`
- Logout on token expiry

## API Endpoints

### Restaurant Authentication

```
POST /api/restaurant-auth/register
Body: {
  restaurantName, ownerName, ownerPhone, ownerEmail, password, confirmPassword,
  address, city, state, pincode, latitude, longitude,
  category, vegNonVeg, openingTime, closingTime, deliveryRadius,
  gstNumber, fssaiLicense
}
Response: { success, message, restaurantId, status: 'PENDING_APPROVAL' }

POST /api/restaurant-auth/login
Body: { email, password }
Response: { success, token, user }
Error 403: { success: false, status: 'PENDING_APPROVAL'|'REJECTED'|'SUSPENDED' }

GET /api/restaurant-auth/profile
Header: Authorization: Bearer {token}
Response: { success, restaurant }
```

### Admin Approval

```
GET /api/admin/restaurants/pending
Response: { success, pending: [...], count }

POST /api/admin/restaurants/:id/approve
Body: { notes, approvedByAdminId }
Response: { success, message }
Emits: restaurantApproved (Socket.IO)

POST /api/admin/restaurants/:id/reject
Body: { rejectionReason, rejectedByAdminId }
Response: { success, message }
Emits: restaurantRejected (Socket.IO)
```

## UI/UX Features

### Premium Design Elements

1. **Animated Statistics**
   - Restaurant count (animates to 500+)
   - Daily orders (animates to 50,000+)
   - Uptime percentage (animates to 98%)

2. **Feature Cards**
   - Real-time Analytics
   - Menu Management
   - Customer Support
   - Multi-location Management

3. **Color Scheme**
   - Dark navy backgrounds (#000A22, #0F172A, #1E293B)
   - Orange gradients (#F97316 - #EA580C)
   - Glassmorphic effects with backdrop blur
   - Subtle animations

4. **Responsive Design**
   - Mobile: Single column layout
   - Tablet: Responsive grid
   - Desktop: Full two-column hero + auth forms

### Support Integration

**Support Button Everywhere**:
- Restaurant login page: "📞 Call Support: 9160776152"
- Approval waiting screen: Support button with tel: link
- Admin panel: Support contact info
- Dashboard: Help sections with support

**Implementation**:
```html
<a href="tel:9160776152">
  <button>Call Support: 9160776152</button>
</a>
```

## Database Schema Changes

### New/Updated Tables

**restaurants**:
- Added: `category`, `veg_non_veg`, `opening_time`, `closing_time`, `delivery_radius_km`
- Updated: `status` field now tracks `PENDING_APPROVAL`, `OPEN`, `REJECTED`, `SUSPENDED`

**restaurant_details**:
- Added: `address`, `city`, `state`, `pincode`

**restaurant_users**:
- Added: `phone` field for uniqueness tracking

**restaurant_approvals**:
- Added: `category`, `veg_non_veg`, `opening_time`, `closing_time`, `delivery_radius_km`

## Status Workflow

```
Registration Submitted
        ↓
PENDING_APPROVAL (restaurant cannot login)
        ↓
    ┌───┴───┐
    ↓       ↓
  OPEN   REJECTED
(approved) (try again)
    ↓
Can Login
    ↓
OPEN (operational)
    ↓
TEMPORARILY_UNAVAILABLE (manually set)
SUSPENDED (admin action)
CLOSED (end of service)
```

## Testing the System

### End-to-End Flow

1. **Signup**
   - Go to `/restaurant-auth`
   - Click "Create Account"
   - Fill all fields with valid data
   - Submit

2. **See Approval Waiting Screen**
   - Verify waiting screen shows
   - Email should be displayed
   - Support button should be clickable

3. **Admin Approval**
   - Go to `/admin/approvals`
   - Find the pending restaurant
   - Click "Approve" button
   - Verify real-time notification

4. **Login Now Works**
   - Go back to `/restaurant/login` or `/restaurant-auth`
   - Login with credentials
   - Dashboard should load

### Test Cases

- ✅ Signup with invalid email
- ✅ Signup with duplicate email
- ✅ Signup with duplicate phone
- ✅ Signup with different passwords (confirm mismatch)
- ✅ Login with pending restaurant (should see waiting screen)
- ✅ Login after approval (should access dashboard)
- ✅ Logout and login again (token works)
- ✅ Admin approve with notes
- ✅ Admin reject with reason
- ✅ Real-time notifications appear

## Environment Variables

```env
# Restaurant Auth
RESTAURANT_JWT_SECRET=your-secret-key-prod

# Admin Auth
ADMIN_JWT_SECRET=your-admin-secret-key-prod

# Support
SUPPORT_PHONE=9160776152

# Socket.IO
SOCKET_ENABLED=true
```

## Migration Steps

### For Existing Restaurants

If you have existing test restaurants, you should:

1. **Update their status**: Change from `'dummy'` to `'OPEN'` if they should be active
2. **Add missing fields**: Populate new columns (category, veg_non_veg, etc.) with defaults
3. **Create approval records**: Add entry in `restaurant_approvals` table with `APPROVED` status
4. **Add restaurant_users**: Ensure each restaurant has a user account

```sql
-- Example migration for existing restaurants
UPDATE restaurants SET 
  status = 'OPEN',
  category = 'multi-cuisine',
  veg_non_veg = 'both',
  opening_time = '10:00',
  closing_time = '22:00',
  delivery_radius_km = 5
WHERE status IN ('dummy', 'test', 'demo');

-- Add to approval history
INSERT INTO restaurant_approvals (restaurant_id, status, approved_at)
SELECT id, 'APPROVED', NOW() FROM restaurants WHERE status = 'OPEN';
```

## Monitoring & Analytics

### Important Metrics to Track

1. **Signup Metrics**
   - Daily signups
   - Completion rate (% who submit after starting signup)
   - Form abandonment points

2. **Approval Metrics**
   - Average approval time
   - Approval rate (% of applied that get approved)
   - Rejection reasons

3. **Login Metrics**
   - Successful logins after approval
   - Failed login attempts
   - Session duration

## Known Limitations & Future Improvements

### Current Status
- ✅ Production-grade authentication flow
- ✅ Professional UI/UX
- ✅ Real-time status updates
- ✅ Admin approval system
- ⏳ Rate limiting (TODO)
- ⏳ Email notifications (TODO)
- ⏳ Document upload (TODO)
- ⏳ Account suspension/reactivation (TODO)
- ⏳ Multi-owner support (TODO)

### Future Enhancements
1. Email notifications for approvals/rejections
2. Document file uploads (restaurant logo, FSSAI certificate)
3. Advanced analytics on application status
4. Batch approval workflow
5. Auto-approval for certain criteria
6. Account suspension workflow
7. Payment gateway integration for fees
8. API key generation for restaurant partners

## Support & Troubleshooting

### Common Issues

**Issue**: Restaurant sees "Verification in Progress" forever
- **Solution**: Check admin panel - may not have been approved yet. Approve manually.

**Issue**: Login fails with correct credentials
- **Solution**: Verify restaurant status in database. Must be 'OPEN', not 'PENDING_APPROVAL'.

**Issue**: Realtime notifications don't appear
- **Solution**: Check Socket.IO connection. Browser console should show connection. Verify `io` is initialized on server.

**Issue**: Duplicate email error despite different emails
- **Solution**: Check for leading/trailing spaces. Use `.trim()` on email fields.

## Contact & Support

**Support Hotline**: 9160776152

**Hours**: 24/7 (automated + manual support)

**Email**: support@thinava.com

---

**Last Updated**: May 21, 2026  
**Version**: 1.0 (Production Ready)  
**Status**: ✅ Ready for Deployment
