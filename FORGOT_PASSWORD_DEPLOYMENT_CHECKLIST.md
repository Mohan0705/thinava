# Forgot Password System - Deployment Checklist

## Pre-Deployment (Development Phase) ✅

### Backend Setup
- ✅ Password reset service created
- ✅ API endpoints implemented (3 total)
- ✅ Database schema created and indexed
- ✅ Migration script ready
- ✅ Error handling implemented
- ✅ Input validation in place
- ✅ Security measures implemented

### Frontend Setup
- ✅ Modal component created and tested
- ✅ Reset password page created and tested
- ✅ Login page updated with forgot password link
- ✅ API client integration complete
- ✅ Form validation implemented
- ✅ Responsive design verified
- ✅ Accessibility considerations addressed

### Testing (Development)
- ✅ Manual testing flow verified
- ✅ Error cases tested
- ✅ API endpoints functional
- ✅ Database migration successful
- ✅ UI/UX verified on multiple devices
- ✅ Security features validated

## Integration Checklist (Before Going Live)

### 1. Email Service Integration
- [ ] Choose email provider:
  - [ ] SendGrid
  - [ ] AWS SES
  - [ ] Mailgun
  - [ ] Other: ______

- [ ] Setup API credentials
- [ ] Create email templates
- [ ] Test email delivery
- [ ] Configure sender email address
- [ ] Add email tracking (optional)
- [ ] Setup bounce handling

**File to update:** `server/src/modules/restaurantPanel/services/passwordResetService.js`

```javascript
// Add email sending:
// await emailService.sendPasswordResetEmail({
//   to: email,
//   resetLink: `${RESET_URL}?token=${token}`,
//   restaurantName: owner.restaurant_name
// })
```

### 2. Rate Limiting
- [ ] Add rate limiting package (express-rate-limit)
- [ ] Limit password reset requests per IP
- [ ] Limit reset requests per email
- [ ] Set reasonable limits:
  - [ ] Max 5 requests per email per hour
  - [ ] Max 20 requests per IP per hour
- [ ] Add to endpoints:
  - [ ] `/password-reset/request`
  - [ ] `/password-reset/confirm`

**Implementation location:** `server/src/routes/restaurant-auth.js`

```javascript
// Example:
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per windowMs
  message: 'Too many password reset requests, please try again later'
})

router.post('/password-reset/request', resetLimiter, asyncHandler(...))
```

### 3. Security Hardening
- [ ] Enable HTTPS only in production
- [ ] Set secure flag on tokens in cookies (if used)
- [ ] Add CSRF protection to forms
- [ ] Implement request signing/verification
- [ ] Add IP whitelisting (optional)
- [ ] Setup security headers
- [ ] Add suspicious activity alerts

### 4. Monitoring & Logging
- [ ] Setup structured logging
- [ ] Log all password reset attempts
- [ ] Monitor failed verification attempts
- [ ] Alert on suspicious patterns:
  - [ ] Multiple resets for same email
  - [ ] Multiple resets from same IP
  - [ ] Unusually high reset request volume
- [ ] Track successful resets
- [ ] Monitor token expiry patterns

**Log structure:**
```json
{
  "timestamp": "2026-05-25T10:30:00Z",
  "event": "password_reset_request",
  "email": "owner@restaurant.com",
  "ip": "192.168.1.1",
  "status": "success|failed",
  "reason": "optional_error_message"
}
```

### 5. Database Maintenance
- [ ] Setup automated backups
- [ ] Configure backup retention (30+ days)
- [ ] Setup disaster recovery plan
- [ ] Create cleanup job for expired tokens:
  - [ ] Run daily or hourly
  - [ ] Delete tokens older than 24 hours
  - [ ] Monitor cleanup logs

**Cleanup task:**
```javascript
// Run periodically (every 6 hours)
const { cleanupExpiredTokens } = require('./passwordResetService')
setInterval(() => cleanupExpiredTokens(), 6 * 60 * 60 * 1000)
```

### 6. Admin Features
- [ ] Create admin endpoint to view reset attempts
- [ ] Create admin endpoint to clear user reset tokens
- [ ] Create admin endpoint to force password reset
- [ ] Add admin audit logs
- [ ] Setup admin alerts for suspicious activity

### 7. Documentation for Support Team
- [ ] Create support guide for common issues
- [ ] Document password reset flow
- [ ] Create troubleshooting guide
- [ ] Setup FAQ for users
- [ ] Create video tutorial (optional)
- [ ] Document how to handle disputes

### 8. User Communication
- [ ] Update terms of service
- [ ] Update privacy policy
- [ ] Create help documentation
- [ ] Add FAQ section
- [ ] Setup support email/chat for reset issues
- [ ] Create in-app help tooltips

## Production Deployment Steps

### Step 1: Pre-Deployment Testing
```bash
# Test all endpoints in staging
npm run test
npm run test:integration

# Verify database migration
node src/database/runPasswordResetMigration.js

# Check email service
node scripts/test-email-service.js
```

### Step 2: Database Migration
```bash
# On production environment
cd server
node src/database/runPasswordResetMigration.js

# Verify tables created
# SELECT * FROM restaurant_password_reset_tokens LIMIT 0;
```

### Step 3: Environment Configuration
Update production `.env`:
```
# Email Service
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your_api_key_here
EMAIL_FROM=noreply@thinava.app

# Password Reset
PASSWORD_RESET_TOKEN_EXPIRY=3600000  # 1 hour in ms
PASSWORD_MIN_LENGTH=8

# Security
RATE_LIMIT_WINDOW=3600000  # 1 hour
RATE_LIMIT_MAX_REQUESTS=5
```

### Step 4: Deploy
```bash
# Build frontend
npm run build:frontend

# Deploy to production
# Using your deployment platform (Render, Vercel, etc.)
git push production main
```

### Step 5: Post-Deployment Verification
- [ ] Test forgot password flow on live
- [ ] Verify email delivery
- [ ] Check database for token creation
- [ ] Monitor error logs
- [ ] Verify analytics tracking
- [ ] Test on multiple devices
- [ ] Verify security headers
- [ ] Check HTTPS enforcement

### Step 6: Monitoring Setup
- [ ] Setup APM (New Relic, DataDog, etc.)
- [ ] Configure alerts
- [ ] Setup dashboards
- [ ] Configure log aggregation (ELK, Splunk, etc.)
- [ ] Setup backup verification

## Ongoing Maintenance

### Weekly Tasks
- [ ] Review password reset logs
- [ ] Check for any errors or failures
- [ ] Monitor email delivery rates
- [ ] Review security alerts

### Monthly Tasks
- [ ] Audit failed password reset attempts
- [ ] Review usage patterns
- [ ] Check token cleanup efficiency
- [ ] Update security policies if needed

### Quarterly Tasks
- [ ] Security audit
- [ ] Update dependencies
- [ ] Review and update documentation
- [ ] Performance optimization review

## Rollback Plan

If issues occur in production:

1. **Immediate**: Disable password reset feature
   - Set API endpoints to return 503 (Service Unavailable)
   - Show message: "Password reset temporarily unavailable"

2. **Short-term**: Revert to previous version
   - `git revert [commit]`
   - Redeploy
   - Verify rollback successful

3. **Investigation**:
   - Check logs for errors
   - Verify database integrity
   - Check email service status
   - Review recent changes

4. **Fix & Retest**:
   - Fix identified issues
   - Test thoroughly in staging
   - Deploy to production
   - Monitor closely

## Success Metrics

Track these metrics to ensure system health:

- **Success Rate**: > 95% of password resets succeed
- **Email Delivery**: > 98% of reset emails delivered
- **Response Time**: < 500ms for API endpoints
- **Error Rate**: < 1% for all operations
- **Token Expiry**: Tokens properly expire after 1 hour
- **Security**: Zero token reuse incidents
- **User Satisfaction**: < 1% support tickets related to password reset

## Contact & Support

### For Issues:
- Check logs: `/var/log/thinava/password-reset.log`
- Review database: `restaurant_password_reset_tokens` table
- Check email service status
- Contact: backend-team@thinava.app

### Emergency Contacts:
- On-call Engineer: [phone]
- Email Service Support: [email]
- Database Administrator: [email]

---

**Last Updated**: May 25, 2026  
**Status**: Ready for Production Deployment ✅
