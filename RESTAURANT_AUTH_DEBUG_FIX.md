# Restaurant Authentication Debug & Fix Guide

## Issue Description
Restaurant accounts can signup initially, but later login shows: "Invalid email or password"

## Root Causes Analysis

### 1. **Password Hashing Mismatch**
- Signup: Hashes with bcrypt (10 rounds)
- Login: Compares with bcrypt.compare()
- **Possible Issue**: Password encoding during transport or storage

### 2. **Email Case Sensitivity**
- Signup: Stores email as-is
- Login: Queries with exact email
- **Fix**: Normalize emails to lowercase

### 3. **Data Type Mismatch**
- Password field might be truncated or corrupted
- Transaction might fail silently

### 4. **Session Persistence**
- Token might not be saved correctly in store
- Token validation might fail on reload

## Implementation Steps

### Step 1: Add Comprehensive Logging

**File: `server/src/routes/restaurant-auth.js`**

Add debug logging for signup:
```javascript
// At line ~200, inside the signup handler, after creating user:
const userResult = await client.query(...)

console.log('🔐 Password Debug Info:', {
  email: ownerEmail,
  password: '****' + password.slice(-3),
  passwordLength: password.length,
  hashedPasswordLength: hashedPassword.length,
  hashAlgorithm: 'bcrypt(10)',
  timestamp: new Date().toISOString()
})

console.log('✅ User Created:', {
  userId: userResult.rows[0].id,
  email: ownerEmail,
  passwordHashStored: !!userResult.rows[0].password_hash,
  isActive: userResult.rows[0].is_active
})
```

Add debug logging for login:
```javascript
// At line ~340, in login handler after bcrypt.compare():
const isPasswordValid = await bcrypt.compare(password, user.password_hash)

console.log('🔐 Login Password Debug:', {
  email: email,
  passwordLength: password.length,
  storedHashLength: user.password_hash?.length,
  storedHashPrefix: user.password_hash?.substring(0, 10),
  isPasswordValid,
  timestamp: new Date().toISOString()
})

if (!isPasswordValid) {
  console.log('❌ Password Verification Failed:', {
    email,
    userId: user.id,
    hashAlgorithmExpected: 'bcrypt',
    receivedHashStart: user.password_hash?.substring(0, 4),
    passwordLength: password.length
  })
  // ... rest of error handling
}
```

### Step 2: Email Normalization

**File: `server/src/routes/restaurant-auth.js`**

In both signup and login, normalize email:
```javascript
// At top of signup handler (line ~89):
const ownerEmail = req.body.ownerEmail.toLowerCase().trim()

// At top of login handler (line ~308):
const email = req.body.email.toLowerCase().trim()
```

### Step 3: Add Password Validation Test Endpoint

**File: `server/src/routes/restaurant-auth.js`**

Add this route for testing:
```javascript
// Add at end of file, before module.exports
router.post('/debug/test-password', asyncHandler(async (req, res) => {
  const { email, password } = req.body
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' })
  }

  try {
    // Find user
    const userResult = await pool.query(
      'SELECT id, password_hash, is_active FROM restaurant_users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (userResult.rows.length === 0) {
      return res.json({
        success: false,
        message: 'User not found',
        email,
        found: false
      })
    }

    const user = userResult.rows[0]
    
    // Test password comparison
    const isValid = await bcrypt.compare(password, user.password_hash)
    
    return res.json({
      success: isValid,
      message: isValid ? 'Password valid' : 'Password invalid',
      debug: {
        email,
        userFound: true,
        userId: user.id,
        isActive: user.is_active,
        passwordHashLength: user.password_hash?.length,
        passwordHashPrefix: user.password_hash?.substring(0, 12),
        passwordHashAlgorithm: user.password_hash?.startsWith('$2') ? 'bcrypt' : 'unknown',
        isPasswordValid: isValid,
        passwordLength: password.length
      }
    })
  } catch (error) {
    console.error('Debug test error:', error)
    res.status(500).json({ error: error.message })
  }
}))
```

### Step 4: Frontend Session Management

**File: `src/store/restaurantOwnerAuthStore.ts`**

Ensure token is properly saved and retrieved:
```typescript
// Add validation in setSession:
const setSession = (owner: RestaurantOwner, token: string) => {
  if (!token || !owner?.id) {
    console.error('❌ Invalid session data:', { owner, token })
    throw new Error('Invalid session data received')
  }
  
  console.log('✅ Setting session:', {
    ownerId: owner.id,
    email: owner.email,
    tokenLength: token.length,
    tokenPrefix: token.substring(0, 20) + '...'
  })
  
  set({
    owner,
    token,
    isAuthenticated: true,
  })
}
```

### Step 5: Error Response Enhancement

**File: `server/src/routes/restaurant-auth.js`**

Provide more detailed error messages in development:
```javascript
// At line ~355, in login error response:
if (!isPasswordValid) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  console.error('❌ Login Failed - Password Mismatch:', {
    email,
    userId: user.id,
    passwordReceived: password.length,
    hashStored: user.password_hash?.substring(0, 20),
    timestamp: new Date().toISOString()
  })
  
  return res.status(401).json({ 
    success: false, 
    error: isDevelopment 
      ? `Password mismatch for ${email}. Hash prefix: ${user.password_hash?.substring(0, 12)}`
      : 'Invalid credentials'
  })
}
```

### Step 6: Frontend Error Handling

**File: `src/app/restaurant-auth/page.tsx`**

Enhance error display:
```typescript
// In handleLogin catch block:
catch (error: any) {
  if (error.status === 403 && error.approvalStatus === 'PENDING_APPROVAL') {
    setAuthStatus('PENDING_APPROVAL')
    setAuthMessage('Our onboarding team is reviewing your restaurant details.')
    setAuthEmail(loginForm.email)
    return
  }
  
  // Log detailed error info
  console.error('🔴 Login Error:', {
    message: error.message,
    status: error.status,
    email: loginForm.email,
    timestamp: new Date().toISOString()
  })
  
  // Show specific error message
  const message = error.message === 'Invalid credentials' 
    ? 'Email or password is incorrect. Please check and try again.'
    : error.message
  
  toast.error(message)
}
```

## Testing Steps

### Test 1: Direct API Test
```bash
# Signup new account
curl -X POST http://localhost:5000/restaurant-auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "TestRest",
    "ownerName": "Test Owner",
    "ownerPhone": "9876543210",
    "ownerEmail": "test@test.com",
    "password": "TestPass@123",
    "confirmPassword": "TestPass@123",
    "address": "123 Main St",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001"
  }'

# Then try login immediately
curl -X POST http://localhost:5000/restaurant-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "TestPass@123"
  }'

# Use debug endpoint to test password
curl -X POST http://localhost:5000/restaurant-auth/debug/test-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "TestPass@123"
  }'
```

### Test 2: Check Server Logs
When testing, look for:
- ✅ User Created logs with password hash details
- 🔐 Login Password Debug logs showing hash comparison
- ❌ Any errors in password verification

### Test 3: Database Query
```sql
-- Check if user was created with password_hash
SELECT id, email, password_hash, is_active FROM restaurant_users 
WHERE email = 'test@test.com';

-- Verify password_hash is not NULL and has bcrypt format ($2a$)
```

## Checklist for Production

- [ ] Add comprehensive logging to signup and login
- [ ] Normalize email to lowercase in both signup and login
- [ ] Add password validation debug endpoint
- [ ] Enhance frontend error handling
- [ ] Test complete signup → login flow
- [ ] Verify token persistence across page reloads
- [ ] Check database for correct password_hash format
- [ ] Review server logs for any encoding issues
- [ ] Test with multiple email formats (uppercase, mixed case)
- [ ] Verify session store updates correctly after login

## Debugging Commands

```bash
# View recent login attempts
tail -50 /var/log/thinava-server.log | grep -E "(Login|Password|Credentials)"

# Check if email normalization is working
psql -h $DB_HOST -d $DB_NAME -c \
  "SELECT email, password_hash FROM restaurant_users ORDER BY created_at DESC LIMIT 5;"

# Test password manually
node -e "
const bcrypt = require('bcryptjs');
const testHash = '\$2a\$10\$...'; // Paste hash from DB
bcrypt.compare('TestPassword123', testHash).then(console.log);
"
```

## Resolution Path

1. **First**: Add logging and run test flow
2. **Observe**: Check server logs for password mismatch details
3. **Fix**: Normalize email, verify bcrypt format
4. **Verify**: Run complete signup → logout → login flow
5. **Confirm**: Check session persists across page reload

