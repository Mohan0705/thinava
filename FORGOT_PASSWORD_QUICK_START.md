# Quick Start Guide - Forgot Password Testing

## 🚀 Quick Setup (5 minutes)

### 1. Database Migration (Already Done ✅)
```bash
# Already ran this - password reset tokens table created
cd server
node src/database/runPasswordResetMigration.js
```

### 2. Start the Application
```bash
# Start both frontend and backend
npm run dev

# Or separately:
npm run dev:backend  # Terminal 1
npm run dev:frontend # Terminal 2
```

## ✅ Test Flow (10 minutes)

### Step 1: Request Password Reset
1. Go to `http://localhost:3000/restaurant-auth`
2. You should see the login form
3. Click **"Forgot Password?"** link below the password field
4. A modal will pop up
5. Enter your restaurant owner email (e.g., `owner@restaurant.com`)
6. Click **"Send Reset Link"**
7. ✅ Success message should appear

**Development Mode:** The reset token will be shown in the modal/console for testing

### Step 2: Verify Token and Access Reset Page
1. Copy the reset token from the modal (or check browser console)
2. Navigate to: `http://localhost:3000/reset-password?token=<YOUR_TOKEN>`
3. The page should:
   - ✅ Load successfully
   - ✅ Show "Verifying reset link..." temporarily
   - ✅ Display your restaurant owner name and email
   - ✅ Show password input fields

### Step 3: Create New Password
1. Enter a new password (minimum 8 characters)
   - Example: `NewPassword123!@#`
2. Re-enter the same password in "Confirm Password"
3. Click **"Reset Password"** button
4. ✅ Success message should appear
5. ✅ Automatically redirect to login page in 2 seconds

### Step 4: Login with New Password
1. You should now be at `http://localhost:3000/restaurant-auth`
2. Enter your email address
3. Enter the NEW password you just created
4. Click **"Sign In"**
5. ✅ You should successfully login to the dashboard

## 🧪 Additional Tests

### Test Error Handling
```bash
# Try with invalid token
http://localhost:3000/reset-password?token=invalid123

# Expected: Error page with "Reset Link Invalid" message
```

### Test Password Validation
1. On reset page, enter password with < 8 characters
2. Try to submit
3. ✅ Error: "Password must be at least 8 characters"

### Test Password Mismatch
1. On reset page, enter different passwords
2. Try to submit
3. ✅ Error: "Passwords do not match"

## 📊 API Testing (curl)

### Request Password Reset
```bash
curl -X POST http://localhost:5000/api/restaurant-auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@restaurant.com"}'

# Response (Dev Mode):
# {
#   "success": true,
#   "message": "Password reset email sent successfully",
#   "email": "owner@restaurant.com",
#   "resetToken": "abc123def456...",
#   "expiresIn": "1 hour"
# }
```

### Verify Token
```bash
TOKEN="your_token_here"

curl -X GET http://localhost:5000/api/restaurant-auth/password-reset/verify/$TOKEN

# Response:
# {
#   "success": true,
#   "message": "Token is valid",
#   "email": "owner@restaurant.com",
#   "fullName": "Owner Name"
# }
```

### Reset Password
```bash
curl -X POST http://localhost:5000/api/restaurant-auth/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your_token_here",
    "newPassword": "NewPassword123",
    "confirmPassword": "NewPassword123"
  }'

# Response:
# {
#   "success": true,
#   "message": "Password reset successfully",
#   "email": "owner@restaurant.com"
# }
```

## 🔒 Security Features Verified

- ✅ Tokens expire after 1 hour
- ✅ Tokens are hashed before storage
- ✅ Passwords are bcrypt hashed (10 rounds)
- ✅ Minimum 8 character password requirement
- ✅ Password confirmation validation
- ✅ Token single-use (marked used after reset)
- ✅ Generic responses (don't reveal email existence)
- ✅ Email validation before processing

## 🎨 UI/UX Features Verified

- ✅ Modal is responsive (mobile, tablet, desktop)
- ✅ Password visibility toggle (eye icon)
- ✅ Real-time validation feedback
- ✅ Loading states with spinners
- ✅ Success/error messages with icons
- ✅ Auto-close modal on success
- ✅ Auto-redirect on password reset
- ✅ Thinava branding (orange, clean design)

## 📱 Mobile Testing

### On Mobile Browser
1. Go to `http://localhost:3000/restaurant-auth` on mobile
2. Click "Forgot Password?" 
3. ✅ Modal should center and fit screen
4. ✅ Buttons and inputs should be touchable
5. ✅ Confirm on reset page works well

## ⚙️ Configuration

### Token Expiry
- Currently: **1 hour**
- Located: `server/src/modules/restaurantPanel/services/passwordResetService.js`
- Change: `new Date(Date.now() + 1 * 60 * 60 * 1000)` to adjust

### Password Requirements
- Currently: **Minimum 8 characters**
- Add more validation as needed in reset service

### Database
- Table: `restaurant_password_reset_tokens`
- Database: Supabase PostgreSQL (aws-1-ap-south-1)

## 🐛 Debugging Tips

### Check Token in Console (Dev Mode)
```javascript
// In browser console after requesting reset
// The token will be visible in network requests
```

### Check Database
```bash
# Connect to Supabase and query
SELECT * FROM restaurant_password_reset_tokens;
```

### Enable Debug Logs
```javascript
// In passwordResetService.js, add:
console.log('Token generated:', token);
console.log('Token hash stored:', tokenHash);
```

## 📋 Checklist Before Production

- [ ] Email service integrated (SendGrid/AWS SES)
- [ ] Rate limiting added on password reset endpoints
- [ ] Logs configured for security monitoring
- [ ] Token expiry reviewed (currently 1 hour)
- [ ] Password policy reviewed
- [ ] HTTPS enabled in production
- [ ] Admin monitoring setup
- [ ] User documentation created
- [ ] Support team trained

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Token invalid/expired | Request new reset link |
| "Passwords don't match" | Ensure passwords are identical |
| Email not received | Check spam, verify email address |
| Modal not appearing | Check browser console for errors |
| Page not loading | Verify token format and expiry |
| Can't login with new password | Ensure you're using the NEW password |

## 📞 Support

For issues or questions, refer to:
- **Documentation**: `/FORGOT_PASSWORD_IMPLEMENTATION.md`
- **Test Guide**: Component in `/src/components/restaurant/ForgotPasswordTestGuide.tsx`
- **API Routes**: `/server/src/routes/restaurant-auth.js`
- **Services**: `/server/src/modules/restaurantPanel/services/passwordResetService.js`

---

**Status: Ready for Testing** ✅
