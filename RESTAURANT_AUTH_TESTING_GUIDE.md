# Restaurant Authentication Testing & Verification Guide

## Build Status
- ✅ Syntax errors fixed
- ✅ TypeScript errors fixed  
- ✅ Email normalization implemented (signup & login)
- ✅ Comprehensive logging added
- ⏳ Build verification in progress

## What Was Fixed

### 1. **Email Normalization** ✅
- Signup: Email converted to lowercase and trimmed
- Login: Email converted to lowercase and trimmed
- **Impact**: Fixes case-sensitivity issues (e.g., Test@gmail.com vs test@gmail.com)

### 2. **Comprehensive Logging** ✅
Added detailed logging at critical points:
- **Signup**:
  - Request received with email
  - Password hashing (length, salt rounds)
  - User created (ID, email, hash length, prefix)

- **Login**:
  - Login attempt with normalized email
  - User lookup result
  - Password verification details (hash algorithm, lengths)
  - Success/failure with diagnostic info
  - Token generation and session creation

### 3. **Response Field Standardization** ✅
- Changed response from `user` to `owner` field for consistency
- Frontend now correctly expects and maps `response.owner`
- Token and owner data properly returned

### 4. **Frontend Error Logging** ✅
- Login errors now logged with status codes
- Helps identify why login fails (credentials vs approval status)

## How to Test

### Test 1: Fresh Signup Flow
```bash
# 1. Start the server
cd c:\THINAVA
npm run dev

# 2. Open browser: http://localhost:3000/restaurant-auth
# 3. Click "Create Account" tab
# 4. Fill form:
   - Restaurant Name: Test Restaurant
   - Owner Name: John Test
   - Owner Phone: 9876543210
   - Owner Email: testowner@example.com
   - Password: TestPass@123456
   - Confirm: TestPass@123456
   - Address: 123 Main Street
   - City: Bangalore
   - State: Karnataka
   - Pincode: 560001

# 5. Click "Register Restaurant"
# 6. Expect: "Registration submitted!" toast + Approval waiting screen
```

### Test 2: Immediate Login After Signup
```bash
# After signup shows approval screen:
# 1. Check Server Logs - Should see:
#    📝 Signup Request: {...}
#    🔐 Hashing password...
#    ✅ Password hashed successfully
#    ✅ Restaurant user created: {...}

# 2. Manually set restaurant status to APPROVED in database:
psql -h $DB_HOST -d postgres -U postgres
UPDATE restaurants SET status = 'APPROVED' WHERE name = 'Test Restaurant';

# 3. Return to login form
# 4. Enter credentials:
#    Email: testowner@example.com
#    Password: TestPass@123456

# 5. Click "Sign In"
# 6. Expect: Successful login → Dashboard
```

### Test 3: Email Case Sensitivity
```bash
# 1. Signup with mixed case:
#    Email: TestOwner@Example.Com

# 2. Try login with different case:
#    Email: testowner@example.com

# 3. Expect: Success! (normalized to lowercase)

# Check server logs for:
#    🔐 Login Attempt: { email: 'testowner@example.com' }
```

### Test 4: Wrong Password
```bash
# 1. Try login with correct email, wrong password
#    Email: testowner@example.com
#    Password: WrongPassword123

# 2. Expect: Error toast "Invalid credentials"

# Check server logs for:
#    🔐 Password verification result: { isPasswordValid: false }
#    ❌ Login failed - Invalid password: {...}
```

### Test 5: Non-existent Email
```bash
# 1. Try login with non-existent email
#    Email: doesntexist@example.com
#    Password: AnyPassword123

# 2. Expect: Error toast "Invalid credentials"

# Check server logs for:
#    🔐 Login Attempt: {...}
#    (No "user found" message in logs)
```

## Database Verification

### Check Created User
```sql
-- View user details
SELECT 
  id, 
  email, 
  password_hash, 
  full_name, 
  is_active, 
  created_at 
FROM restaurant_users 
WHERE email = 'testowner@example.com';

-- Expected output:
-- id | email | password_hash | full_name | is_active | created_at
-- 1 | testowner@example.com | $2a$10$... | John Test | t | 2026-05-25...
```

### Verify Password Hash Format
```sql
-- Check if password is properly hashed with bcrypt
SELECT 
  email,
  substring(password_hash, 1, 20) as hash_prefix,
  length(password_hash) as hash_length
FROM restaurant_users 
WHERE email = 'testowner@example.com';

-- Expected: Hash starts with "$2a$10$" and is about 60 characters long
```

### Check Restaurant Status
```sql
-- View restaurant approval status
SELECT 
  r.id, 
  r.name, 
  r.status,
  ru.email,
  ru.full_name
FROM restaurants r
JOIN restaurant_users ru ON r.id = ru.restaurant_id
WHERE ru.email = 'testowner@example.com';

-- Expected status for testing: APPROVED (or temporarily set it)
```

## Server Log Analysis

### Successful Signup Pattern
```
📝 Signup Request: {
  restaurantName: 'Test Restaurant',
  ownerEmail: 'testowner@example.com',
  ...
}

🔐 Hashing password...
✅ Password hashed successfully
✅ Restaurant user created: {
  userId: 123,
  email: 'testowner@example.com',
  passwordHashStored: true,
  passwordHashPrefix: '$2a$10$abc...'
}
```

### Successful Login Pattern
```
🔐 Login Attempt: {
  email: 'testowner@example.com',
  passwordLength: 17
}

🔍 Login attempt: {
  userFound: true,
  restaurantStatus: 'APPROVED',
  passwordHashExists: true,
  passwordHashLength: 60
}

🔐 Password verification result: {
  isPasswordValid: true,
  hashAlgorithm: 'bcrypt'
}

✅ Password verified: {
  email: 'testowner@example.com',
  userId: 123
}

✅ Login successful - Token generated: {
  tokenLength: 256,
  tokenPrefix: 'eyJhbGciOiJIUzI1NiI...'
}
```

### Failed Login - Wrong Password
```
🔐 Password verification result: {
  isPasswordValid: false
}

❌ Login failed - Invalid password: {
  hashPrefix: '$2a$10$...',
  timestamp: '2026-05-25T...'
}
```

## Troubleshooting

### Issue: "Invalid email or password" on correct credentials

**Step 1**: Check server logs for login attempt
```bash
# Look for:
# ✅ Password verified: {} <- If you see this, password WAS correct
# ❌ Login failed - Invalid password: {} <- Password was WRONG
```

**Step 2**: Verify password hash in database
```sql
SELECT email, substring(password_hash, 1, 12) FROM restaurant_users;
-- Should show: $2a$10$ (bcrypt format)
```

**Step 3**: Check restaurant status
```sql
SELECT r.status FROM restaurants r 
JOIN restaurant_users ru ON r.id = ru.restaurant_id
WHERE ru.email = 'test@test.com';
-- Should be: APPROVED (not PENDING_APPROVAL)
```

**Step 4**: Manually test bcrypt
```javascript
// In Node.js REPL
const bcrypt = require('bcryptjs');
const hash = '$2a$10$...'; // From database
const password = 'YourPassword123';
bcrypt.compare(password, hash).then(console.log);
// Should print: true
```

### Issue: Login shows "Restaurant pending approval"

**This is expected behavior!** New restaurants must be approved by admin before owners can log in.

**To test**:
1. Set restaurant status to APPROVED:
```sql
UPDATE restaurants SET status = 'APPROVED' WHERE name = 'Test Restaurant';
```
2. Try login again

### Issue: Email case sensitivity still affecting login

**Fix**: Verify both signup and login normalize email:
- Signup: `const ownerEmail = rawEmail.toLowerCase().trim()`
- Login: `const email = rawEmail.toLowerCase().trim()`

### Issue: Password not being verified correctly

**Possible causes**:
1. Password_hash column has wrong data type (should be VARCHAR/TEXT, not CHAR)
2. Password being truncated during storage
3. Bcrypt version mismatch

**Check**:
```sql
-- Check column type and max length
SELECT data_type, character_maximum_length 
FROM information_schema.columns
WHERE table_name = 'restaurant_users' AND column_name = 'password_hash';
```

## Session Persistence Test

### Test 1: Session survives page reload
```
1. Login successfully
2. Refresh page (F5)
3. Expect: Still logged in, dashboard displays
```

### Test 2: Session survives navigation
```
1. Login successfully
2. Go to dashboard
3. Click various menu items
4. Expect: Session persists, no re-login needed
```

### Test 3: Logout clears session
```
1. Logout from dashboard
2. Try accessing /restaurant/dashboard directly
3. Expect: Redirected to /restaurant-auth login page
```

## Next Steps After Verification

1. ✅ Verify email normalization works
2. ✅ Check password hashing and comparison
3. ✅ Confirm session persistence
4. ✅ Test error messages are helpful
5. ⚠️ Set up error monitoring for production
6. ⚠️ Add rate limiting to login endpoint
7. ⚠️ Implement account lockout after failed attempts

## Production Checklist

Before deploying to production:
- [ ] All tests pass locally
- [ ] Password hashes verified in database
- [ ] Email normalization confirmed
- [ ] Server logs validated
- [ ] Session persistence works
- [ ] Error messages helpful but not revealing
- [ ] Rate limiting configured
- [ ] Monitoring/alerting set up
- [ ] Backup and recovery plan ready
- [ ] User documentation updated

