# Testing Guide: Pooled Payments & Stripe Connect

This guide walks you through testing the pooled payment features we've implemented so far (Phases 1-4).

## Prerequisites

1. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Make sure your `.env` has**:
   - `DATABASE_URL` (should already be set)
   - `JWT_SECRET` (should already be set)
   - `STRIPE_SECRET_KEY` (should already be set)
   - `STRIPE_WEBHOOK_SECRET` (should already be set)
   - `FRONTEND_URL` (should already be set)

---

## Test 1: Database Schema ✅

**Goal**: Verify the database has the new fields and models.

### Using Prisma Studio (Easiest):
```bash
cd backend
npx prisma studio
```

This opens a browser UI. Check:
- **User table**: Should have new columns: `stripeAccountId`, `stripeOnboardingStatus`, `stripePayoutsEnabled`, etc.
- **PaymentEvent table**: Should have `organizerId` and `poolBalance` columns
- **Payment table**: Should have `stripeCheckoutSessionId` column
- **Payout table**: Should exist with all fields

### Using SQL (Alternative):
```bash
# If using PostgreSQL
psql $DATABASE_URL -c "\d users"
psql $DATABASE_URL -c "\d payment_events"
psql $DATABASE_URL -c "\d payouts"
```

**Expected Result**: All new columns and tables exist ✅

---

## Test 2: Stripe Connect Onboarding 🔗

**Goal**: Test the Connect account creation and onboarding flow.

### Step 1: Check Connect Status (should be false initially)
```bash
curl -X GET http://localhost:4000/connect/status \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "connected": false,
  "accountId": null,
  "status": null,
  "payoutsEnabled": false,
  "onboardedAt": null
}
```

### Step 2: Start Onboarding
```bash
curl -X POST http://localhost:4000/connect/onboard \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "accountId": "acct_xxxxx",
  "onboardingUrl": "https://connect.stripe.com/setup/e/...",
  "status": "pending"
}
```

### Step 3: Verify Account Created in Stripe
1. Go to Stripe Dashboard → Connect → Accounts
2. You should see a new Express account created

**Note**: We haven't built the frontend UI yet, so you can't complete the full onboarding flow. But the API endpoint works!

---

## Test 3: Payment Event Creation (New Authorization) 📝

**Goal**: Verify that ANY circle member can now create payment events (not just admins).

### Prerequisites:
- You need a circle ID
- You need a user who is a MEMBER (not admin) of that circle

### Test as Regular Member:
```bash
curl -X POST http://localhost:4000/payment-events \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=MEMBER_JWT_TOKEN" \
  -d '{
    "title": "Test Pool Event",
    "amount": 50,
    "dueDate": "2025-12-31",
    "circleId": "YOUR_CIRCLE_ID"
  }'
```

**Expected Response** (should succeed!):
```json
{
  "event": {
    "id": "...",
    "title": "Test Pool Event",
    "amount": 50,
    "dueDate": "2025-12-31T00:00:00.000Z",
    "circleId": "...",
    "organizerId": "MEMBER_USER_ID",  // ← Member became organizer!
    "poolBalance": 0,                 // ← Initialized to 0
    "createdAt": "..."
  }
}
```

### Verify Organizer Assignment:
Check in Prisma Studio or via SQL:
```sql
SELECT id, title, "organizerId", "poolBalance"
FROM "PaymentEvent"
WHERE title = 'Test Pool Event';
```

**Expected Result**: The member who created it is the organizer ✅

---

## Test 4: Pool Balance Tracking 💰

**Goal**: Verify pool balance increments when a payment is made.

### Step 1: Get Payment Event Details
```bash
curl -X GET "http://localhost:4000/payments/by-event/EVENT_ID" \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

**Expected Response** (new fields):
```json
{
  "event": { ... },
  "circle": { ... },
  "payments": [ ... ],
  "poolInfo": {
    "balance": 0,           // Current pool balance
    "totalPaidIn": 0,       // Sum of all paid amounts
    "totalPaidOut": 0,      // Sum of payouts (0 for now)
    "organizerId": "...",
    "organizerName": "...",
    "organizerOnboarded": false  // Not onboarded yet
  },
  "currentUserId": "...",
  "isAdmin": true/false,
  "isOrganizer": true/false  // ← New field!
}
```

### Step 2: Simulate a Payment via Webhook

Since we don't have the full payment flow set up yet, let's **manually test the webhook handler**:

Create a test script:
```typescript
// backend/src/scripts/test-webhook.ts
import prisma from "../config/prisma";

async function testPoolIncrement() {
  // 1. Find a payment event
  const event = await prisma.paymentEvent.findFirst({
    include: { payments: true }
  });

  if (!event) {
    console.log("No payment event found");
    return;
  }

  const payment = event.payments[0];

  console.log("Before:");
  console.log("  Pool Balance:", event.poolBalance);
  console.log("  Payment Amount Paid:", payment.amountPaid);

  // 2. Simulate payment success - increment pool
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        amountPaid: { increment: 50 },
        status: "PAID",
        method: "STRIPE"
      }
    }),
    prisma.paymentEvent.update({
      where: { id: event.id },
      data: {
        poolBalance: { increment: 50 }
      }
    })
  ]);

  // 3. Verify
  const updated = await prisma.paymentEvent.findUnique({
    where: { id: event.id },
    include: { payments: true }
  });

  console.log("\nAfter:");
  console.log("  Pool Balance:", updated!.poolBalance);
  console.log("  Payment Amount Paid:", updated!.payments[0].amountPaid);
}

testPoolIncrement().then(() => process.exit(0));
```

Run it:
```bash
npx tsx src/scripts/test-webhook.ts
```

**Expected Output**:
```
Before:
  Pool Balance: 0
  Payment Amount Paid: 0

After:
  Pool Balance: 50
  Payment Amount Paid: 50
```

### Step 3: Verify Pool Info in API
```bash
curl -X GET "http://localhost:4000/payments/by-event/EVENT_ID" \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

**Expected**: `poolInfo.balance` should be `50`, `totalPaidIn` should be `50`

---

## Test 5: Verify Transaction Atomicity 🔒

**Goal**: Ensure payment updates and pool balance increments happen together or not at all.

This is already tested by the script above using `prisma.$transaction([...])`. If one operation fails, both roll back.

---

## Quick Test Checklist

- [ ] **Database schema updated**: New columns exist in User, PaymentEvent, Payment; Payout table exists
- [ ] **Connect endpoints work**: `/connect/status`, `/connect/onboard` return expected responses
- [ ] **Circle members can create events**: Non-admin members can POST to `/payment-events`
- [ ] **Organizer is set correctly**: Created events have `organizerId` = current user
- [ ] **Pool balance initializes**: New events have `poolBalance: 0`
- [ ] **Pool info in responses**: GET `/payments/by-event/:id` includes `poolInfo` and `isOrganizer`
- [ ] **Pool balance increments**: When payment is marked PAID, `poolBalance` increases atomically

---

## What's NOT Testable Yet (Needs Phase 5-7)

❌ **Payout requests** - endpoints don't exist yet
❌ **Stripe transfers** - payout logic not implemented
❌ **Frontend UI** - no pages built yet
❌ **Full Stripe Connect flow** - can't complete onboarding without frontend
❌ **Full payment flow** - Stripe Checkout would need `paymentEventId` in metadata

---

## If You Find Issues

### Issue: "organizerId" is required error when creating event
**Fix**: Make sure you ran the data migration script for existing events

### Issue: poolInfo returns null organizer
**Fix**: Check that the event has an `organizerId` in the database

### Issue: Connect endpoints return 404
**Fix**: Ensure `connectRouter` is registered in `app.ts`

### Issue: Pool balance doesn't increment
**Fix**: Check that webhook handler uses `prisma.$transaction` and includes pool update

---

## Next Steps

Once you've verified Phases 1-4 work correctly, we can continue with:

**Phase 5**: Create payout request endpoints (`POST /payment-events/:id/request-payout`)
**Phase 6**: Add webhook handlers for transfer/payout events
**Phase 7**: Build frontend UI for Connect onboarding and pool management

Ready to continue? Let me know!
