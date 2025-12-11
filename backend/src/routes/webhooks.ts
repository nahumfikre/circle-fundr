import { Router, Request, Response } from "express";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import prisma from "../config/prisma";
import Stripe from "stripe";

const webhookRouter = Router();

// POST /webhooks/stripe
// Stripe sends events here (checkout.session.completed, etc.)
// IMPORTANT: This route needs raw body, so it must be registered BEFORE express.json() middleware
webhookRouter.post(
  "/stripe",
  async (req: Request, res: Response) => {
    console.log("🔔 Webhook received from Stripe");

    if (!stripe) {
      console.error("❌ Stripe is not configured");
      return res.status(500).json({ message: "Stripe is not configured" });
    }

    const sig = req.headers["stripe-signature"];

    if (!sig || typeof sig !== "string") {
      console.error("❌ Missing stripe-signature header");
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    if (!env.stripeWebhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET is not set in environment");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        env.stripeWebhookSecret
      );
      console.log("✅ Webhook signature verified");
      console.log("📋 Event type:", event.type);
    } catch (err: any) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    try {
      // Handle transfer.failed separately (not in Stripe's official types)
      if (event.type === "transfer.failed" as any) {
        const transfer = (event as any).data.object;
        console.log("⚠️  Processing transfer.failed");
        await handleTransferFailed(transfer);
        return res.json({ received: true });
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log("💳 Processing checkout.session.completed");
          await handleCheckoutSessionCompleted(session);
          break;
        }

        // Stripe Connect account events
        case "account.updated": {
          const account = event.data.object as Stripe.Account;
          console.log("🔗 Processing account.updated");
          await handleAccountUpdated(account);
          break;
        }

        case "account.application.deauthorized": {
          const account = event.data.object as unknown as Stripe.Account;
          console.log("❌ Processing account.application.deauthorized");
          await handleAccountDeauthorized(account);
          break;
        }

        // Transfer events (for payouts)
        case "transfer.created": {
          const transfer = event.data.object as Stripe.Transfer;
          console.log("💸 Processing transfer.created");
          await handleTransferCreated(transfer);
          break;
        }

        default:
          console.log(`ℹ️  Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Error processing webhook event:", err);
      return res.status(500).json({ message: "Webhook handler failed" });
    }
  }
);

export default webhookRouter;

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  console.log("📝 Session ID:", session.id);
  console.log("💰 Payment status:", session.payment_status);

  const metadata = session.metadata;
  if (!metadata) {
    console.error("❌ No metadata in session");
    return;
  }

  console.log("📋 Metadata:", metadata);

  const { paymentId, chargeAmount, paymentEventId } = metadata;

  if (!paymentId) {
    console.error("❌ No paymentId in session metadata");
    return;
  }

  console.log("🔍 Looking for payment ID:", paymentId);

  // Verify payment was successful
  if (session.payment_status !== "paid") {
    console.log(`⚠️  Session ${session.id} payment status is ${session.payment_status}, not updating`);
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      event: true,
    },
  });

  if (!payment) {
    console.error(`❌ Payment ${paymentId} not found in database`);
    return;
  }

  console.log("✅ Found payment record");
  console.log("💵 Current amountPaid:", payment.amountPaid);
  console.log("💵 Event amount:", payment.event.amount);

  // Parse the amount that was actually charged
  const amountCharged = chargeAmount ? parseFloat(chargeAmount) : 0;
  const newTotalPaid = payment.amountPaid + amountCharged;

  console.log("💵 Amount charged:", amountCharged);
  console.log("💵 New total paid:", newTotalPaid);

  console.log("🔄 Updating payment and pool balance in database...");

  // Use transaction to atomically update payment and pool balance
  await prisma.$transaction([
    // 1. Update Payment record
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        amountPaid: newTotalPaid,
        status: "PAID",
        method: "STRIPE",
        paidAt: new Date(),
        stripeIntentId: session.id,
        stripeCheckoutSessionId: session.id,
      },
    }),

    // 2. Increment PaymentEvent pool balance
    prisma.paymentEvent.update({
      where: { id: payment.paymentEventId },
      data: {
        poolBalance: {
          increment: amountCharged,
        },
      },
    }),
  ]);

  console.log(
    `✅ Updated payment ${paymentId}: added $${amountCharged}, total now $${newTotalPaid}`
  );
  console.log(
    `✅ Incremented pool balance for event ${payment.paymentEventId} by $${amountCharged}`
  );
}

/**
 * Handle Stripe Connect account updates
 * Updates user's Connect onboarding status and payout capabilities
 */
async function handleAccountUpdated(account: Stripe.Account) {
  console.log("📋 Account ID:", account.id);
  console.log("✅ Details submitted:", account.details_submitted);
  console.log("💰 Payouts enabled:", account.payouts_enabled);

  const user = await prisma.user.findUnique({
    where: { stripeAccountId: account.id },
  });

  if (!user) {
    console.error(`❌ User with Stripe account ${account.id} not found`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeOnboardingStatus: account.details_submitted ? "complete" : "pending",
      stripeDetailsSubmitted: account.details_submitted || false,
      stripePayoutsEnabled: account.payouts_enabled || false,
      stripeOnboardedAt:
        account.details_submitted && !user.stripeOnboardedAt
          ? new Date()
          : user.stripeOnboardedAt,
    },
  });

  console.log(
    `✅ Updated user ${user.id}: onboarding ${account.details_submitted ? "complete" : "pending"}`
  );
}

/**
 * Handle Connect account deauthorization
 * Clears Connect account data when user disconnects
 */
async function handleAccountDeauthorized(account: Stripe.Account) {
  console.log("📋 Account ID:", account.id);

  const user = await prisma.user.findUnique({
    where: { stripeAccountId: account.id },
    include: {
      organizedEvents: {
        select: {
          id: true,
          title: true,
          poolBalance: true,
        },
      },
    },
  });

  if (!user) {
    console.error(`❌ User with Stripe account ${account.id} not found`);
    return;
  }

  // Check if they have active pool balances
  const eventsWithBalance = user.organizedEvents.filter((e) => e.poolBalance > 0);

  if (eventsWithBalance.length > 0) {
    console.warn(
      `⚠️  User ${user.id} disconnected account with ${eventsWithBalance.length} events having pool balances`
    );
    // TODO: Send email notification to user
  }

  // Clear Connect account data
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeAccountId: null,
      stripeOnboardingStatus: null,
      stripeDetailsSubmitted: false,
      stripePayoutsEnabled: false,
      stripeOnboardedAt: null,
    },
  });

  console.log(`✅ Cleared Connect account data for user ${user.id}`);
}

/**
 * Handle transfer creation
 * Updates payout status when transfer is created
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  console.log("📋 Transfer ID:", transfer.id);
  console.log("💰 Amount:", transfer.amount / 100);

  const payoutId = transfer.metadata.payoutId;

  if (!payoutId) {
    console.log("ℹ️  No payoutId in transfer metadata, skipping");
    return;
  }

  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: "in_transit",
      stripeTransferId: transfer.id,
    },
  });

  console.log(`✅ Updated payout ${payoutId}: status = in_transit`);
}

/**
 * Handle transfer failure
 * Refunds pool balance and marks payout as failed
 */
async function handleTransferFailed(transfer: any) {
  console.log("📋 Transfer ID:", transfer.id);
  console.log("❌ Failure code:", transfer.failure_code);
  console.log("❌ Failure message:", transfer.failure_message);

  const payoutId = transfer.metadata.payoutId;

  if (!payoutId) {
    console.log("ℹ️  No payoutId in transfer metadata, skipping");
    return;
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { event: true },
  });

  if (!payout) {
    console.error(`❌ Payout ${payoutId} not found`);
    return;
  }

  // Refund pool balance and mark payout as failed (atomic)
  await prisma.$transaction([
    prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: "failed",
        failureReason: transfer.failure_message || "Transfer failed",
      },
    }),
    prisma.paymentEvent.update({
      where: { id: payout.paymentEventId },
      data: {
        poolBalance: {
          increment: payout.amount, // Refund the amount
        },
      },
    }),
  ]);

  console.log(`✅ Refunded $${payout.amount} to pool balance for event ${payout.paymentEventId}`);
  console.log(`✅ Marked payout ${payoutId} as failed`);

  // TODO: Send email notification to organizer about failed payout
}

export { webhookRouter };
