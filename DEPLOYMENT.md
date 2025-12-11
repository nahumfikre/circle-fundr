# CircleFundr Deployment Checklist

This document provides a comprehensive checklist for deploying CircleFundr to production.

## Pre-Deployment Security Checklist

### ✅ Backend Security (COMPLETED)
- [x] Helmet middleware added for security headers
- [x] CORS configured to whitelist frontend URL only
- [x] Global rate limiting implemented (100 req/15min)
- [x] Auth endpoint rate limiting (5 login attempts/15min)
- [x] Email verification rate limiting (5 attempts/hour)
- [x] Resend verification rate limiting (3 attempts/hour)
- [x] Password complexity validation (8+ chars, uppercase, lowercase, number, special char)
- [x] Request body size limits (10kb)
- [x] Environment variable validation at startup
- [x] Removed weak JWT secret fallbacks
- [x] Duplicate DELETE route handlers removed

### ✅ Frontend Security (COMPLETED)
- [x] Hardcoded localhost URLs replaced with environment variables
- [x] Test credentials removed from login page
- [x] Environment variable system configured

### ✅ Configuration (COMPLETED)
- [x] .env.example files created for documentation
- [x] .env files added to .gitignore (secrets protected)

## Environment Setup

### Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Security Secrets (CRITICAL - Use strong secrets!)
JWT_SECRET=<generate-with: openssl rand -base64 32>
SESSION_SECRET=<generate-with: openssl rand -base64 32>

# Stripe
STRIPE_SECRET_KEY=sk_live_...  # Use LIVE keys for production
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs
FRONTEND_URL=https://your-production-frontend-url.com

# Google OAuth
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=<gmail-app-password>
EMAIL_FROM=CircleFundr <your-email@gmail.com>
```

### Frontend Environment Variables

Copy `frontend/.env.example` to `frontend/.env.production` and configure:

```bash
NEXT_PUBLIC_API_URL=https://your-production-backend-url.com
NEXT_PUBLIC_FRONTEND_URL=https://your-production-frontend-url.com
```

## Deployment Steps

### 1. Stripe Configuration

**Test Mode → Live Mode**
- [ ] Go to https://dashboard.stripe.com/
- [ ] Switch from Test mode to Live mode
- [ ] Activate **Stripe Connect** (required for payouts):
  - Go to Connect → Settings
  - Select "Platform" as account type
  - Complete Connect onboarding questionnaire
- [ ] Copy your **Live API Secret Key** → `STRIPE_SECRET_KEY`
- [ ] Set up webhook endpoint:
  - URL: `https://your-backend-url.com/webhooks/stripe`
  - Events to listen for:
    - `checkout.session.completed`
    - `checkout.session.expired`
    - `account.updated`
    - `account.application.deauthorized`
    - `transfer.created`
    - `transfer.failed`
  - Copy webhook secret → `STRIPE_WEBHOOK_SECRET`

### 2. Google OAuth Configuration

**Update Authorized URLs**
- [ ] Go to https://console.cloud.google.com/
- [ ] Select your project
- [ ] Navigate to: APIs & Services → Credentials
- [ ] Click on your OAuth 2.0 Client ID
- [ ] Update **Authorized JavaScript origins**:
  - Add: `https://your-production-frontend-url.com`
- [ ] Update **Authorized redirect URIs**:
  - Add: `https://your-production-backend-url.com/auth/google/callback`
- [ ] Save changes

### 3. Gmail App Password

**For Email Verification**
- [ ] Ensure 2FA is enabled on your Gmail account
- [ ] Generate App Password: https://myaccount.google.com/apppasswords
- [ ] Copy 16-character password (remove spaces) → `EMAIL_PASSWORD`

### 4. Database Setup

**Production Database**
- [ ] Provision PostgreSQL database (Railway, Supabase, AWS RDS, etc.)
- [ ] Copy connection string → `DATABASE_URL`
- [ ] Run Prisma migrations:
  ```bash
  cd backend
  npx prisma migrate deploy
  npx prisma generate
  ```

### 5. Generate Strong Secrets

**CRITICAL - Do not skip this step!**

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Session Secret
openssl rand -base64 32
```

Copy these to your production `.env` file.

### 6. Backend Deployment

**Recommended Platforms: Railway, Render, Heroku, AWS, DigitalOcean**

- [ ] Set all backend environment variables in your platform
- [ ] Ensure `NODE_ENV=production`
- [ ] Build command: `npm run build` or `npx tsc`
- [ ] Start command: `npm start` or `node dist/server.js`
- [ ] Verify the backend is accessible at your production URL
- [ ] Test health check: `https://your-backend-url.com/health`

### 7. Frontend Deployment

**Recommended Platforms: Vercel, Netlify, AWS Amplify, Cloudflare Pages**

- [ ] Set all frontend environment variables in your platform:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_FRONTEND_URL`
- [ ] Build command: `npm run build`
- [ ] Output directory: `.next`
- [ ] Deploy and verify

### 8. CORS Verification

- [ ] Verify `FRONTEND_URL` in backend `.env` matches your production frontend URL
- [ ] Test frontend can communicate with backend
- [ ] Check browser console for CORS errors

### 9. Final Security Checks

- [ ] All secrets in production environment variables (not in code)
- [ ] `.env` files NOT committed to git
- [ ] All endpoints using HTTPS (not HTTP)
- [ ] Rate limiting working (test with multiple requests)
- [ ] Password complexity enforced (try weak password)
- [ ] Email verification required (register new account)

### 10. Functionality Testing

**Critical User Flows**
- [ ] User registration with email verification
- [ ] Login with verified account
- [ ] Google OAuth sign-in
- [ ] Create workspace
- [ ] Create circle
- [ ] Add members to circle
- [ ] Create payment event
- [ ] Stripe checkout flow
- [ ] Payment confirmation
- [ ] Mark payment as paid manually
- [ ] Delete workspace (cascade deletes)

### 11. Monitoring & Logging

**Post-Deployment**
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor API response times
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Monitor database performance
- [ ] Set up alerts for failed payments
- [ ] Check email delivery rates

## Rollback Plan

If something goes wrong:

1. **Immediate**: Switch DNS/deployment back to previous version
2. **Database**: Keep database backups before migrations
3. **Secrets**: Keep a secure backup of all production secrets
4. **Stripe**: Can switch back to test mode if needed

## Security Best Practices

### Ongoing Maintenance

- [ ] Regularly rotate JWT and session secrets
- [ ] Monitor rate limit logs for abuse
- [ ] Review Stripe webhook logs
- [ ] Keep dependencies updated (`npm audit`, `npm update`)
- [ ] Review and update disposable email blocklist
- [ ] Monitor for suspicious login attempts
- [ ] Regular database backups

### Additional Recommendations

**Not Yet Implemented (Future Enhancements)**
- [ ] Password reset functionality
- [ ] Email change verification
- [ ] Two-factor authentication (2FA)
- [ ] Admin dashboard
- [ ] Audit logging for sensitive operations
- [ ] IP-based geoblocking for high-risk regions
- [ ] Content Security Policy (CSP) headers
- [ ] Webhook signature verification improvements

## Support & Documentation

### Useful Links
- Stripe Dashboard: https://dashboard.stripe.com/
- Google Cloud Console: https://console.cloud.google.com/
- Prisma Docs: https://www.prisma.io/docs/
- Next.js Deployment: https://nextjs.org/docs/deployment

### Environment Variable Quick Reference

**Backend** (11 required):
- DATABASE_URL, JWT_SECRET, SESSION_SECRET
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- FRONTEND_URL
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM

**Frontend** (2 required):
- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_FRONTEND_URL

---

## ✅ Deployment Status

**Last Updated**: 2025-12-04

**Production Readiness**: ✅ Ready for deployment

All critical security issues have been addressed. Follow this checklist carefully for a successful deployment.
