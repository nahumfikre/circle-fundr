import { Router, Request, Response } from "express";
import { stripe } from "../config/stripe";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

// All payout routes require authentication
router.use(authMiddleware);

// Rate limiting for payout requests (max 5 per hour)
const payoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many payout requests. Please try again later.",
});

/**
 * Helper: Ensure user is the organizer of the event
 */
async function ensureEventOrganizer(userId: string, eventId: string) {
  const event = await prisma.paymentEvent.findUnique({
    where: { id: eventId },
    include: {
      organizer: true,
      circle: true,
    },
  });

  if (!event) {
    return {
      ok: false as const,
      status: 404,
      message: "Payment event not found",
    };
  }

  if (event.organizerId !== userId) {
    return {
      ok: false as const,
      status: 403,
      message: "Only the event organizer can request payouts",
    };
  }

  if (!event.organizer.stripeAccountId) {
    return {
      ok: false as const,
      status: 403,
      message: "You must connect a bank account before requesting payouts",
    };
  }

  if (!event.organizer.stripePayoutsEnabled) {
    return {
      ok: false as const,
      status: 403,
      message: "Your Stripe account is not yet enabled for payouts. Please complete onboarding.",
    };
  }

  return {
    ok: true as const,
    event,
  };
}

/**
 * POST /payment-events/:eventId/request-payout
 * Request a payout from the event's pool balance
 *
 * Body: { amount?: number }
 * - If amount not provided, withdraws entire pool balance
 */
router.post(
  "/:eventId/request-payout",
  payoutLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { eventId } = req.params;
      const { amount } = req.body as { amount?: number };

      // 1. Verify organizer and account status
      const check = await ensureEventOrganizer(userId, eventId);
      if (!check.ok) {
        return res.status(check.status).json({ message: check.message });
      }

      const { event } = check;

      // 2. Determine payout amount
      const requestedAmount = amount ?? event.poolBalance;

      // 3. Validate amount
      if (requestedAmount <= 0) {
        return res.status(400).json({
          message: "Payout amount must be greater than zero",
        });
      }

      if (requestedAmount > event.poolBalance) {
        return res.status(400).json({
          message: `Insufficient balance. Available: $${event.poolBalance.toFixed(2)}`,
          availableBalance: event.poolBalance,
        });
      }

      // 4. Check for pending payouts
      const pendingPayout = await prisma.payout.findFirst({
        where: {
          paymentEventId: eventId,
          status: { in: ["pending", "in_transit"] },
        },
      });

      if (pendingPayout) {
        return res.status(400).json({
          message: "A payout is already in progress for this event",
          pendingPayout: {
            id: pendingPayout.id,
            amount: pendingPayout.amount,
            status: pendingPayout.status,
            requestedAt: pendingPayout.requestedAt,
          },
        });
      }

      // 5. Create payout and decrement pool balance (atomic transaction)
      const payout = await prisma.$transaction(async (tx) => {
        // Create payout record
        const payout = await tx.payout.create({
          data: {
            paymentEventId: eventId,
            organizerId: userId,
            amount: requestedAmount,
            status: "pending",
          },
        });

        // Decrement pool balance
        await tx.paymentEvent.update({
          where: { id: eventId },
          data: {
            poolBalance: {
              decrement: requestedAmount,
            },
          },
        });

        return payout;
      });

      // 6. Create Stripe transfer to Connect account
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(requestedAmount * 100), // Convert to cents
          currency: "usd",
          destination: event.organizer.stripeAccountId!,
          metadata: {
            payoutId: payout.id,
            paymentEventId: eventId,
            organizerId: userId,
            eventTitle: event.title,
          },
        });

        // Update payout with Stripe transfer ID
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            stripeTransferId: transfer.id,
          },
        });

        console.log(
          `✅ Payout ${payout.id}: $${requestedAmount} transferred to ${event.organizer.stripeAccountId}`
        );

        return res.status(201).json({
          payout: {
            id: payout.id,
            amount: payout.amount,
            status: payout.status,
            requestedAt: payout.requestedAt,
            stripeTransferId: transfer.id,
          },
          remainingBalance: event.poolBalance - requestedAmount,
          message: "Payout requested successfully. Funds will arrive in 2-7 business days.",
        });
      } catch (stripeError: any) {
        console.error("Stripe transfer failed:", stripeError);

        // Rollback: Delete payout and restore pool balance
        await prisma.$transaction([
          prisma.payout.delete({
            where: { id: payout.id },
          }),
          prisma.paymentEvent.update({
            where: { id: eventId },
            data: {
              poolBalance: {
                increment: requestedAmount,
              },
            },
          }),
        ]);

        return res.status(500).json({
          message: "Failed to process payout through Stripe",
          error: stripeError.message,
        });
      }
    } catch (error: any) {
      console.error("Request payout error:", error);
      return res.status(500).json({
        message: "Failed to request payout",
        error: error.message,
      });
    }
  }
);

/**
 * GET /payment-events/:eventId/payouts
 * Get payout history for a specific payment event
 */
router.get("/:eventId/payouts", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;

    // Verify user is a circle member (can view payouts)
    const event = await prisma.paymentEvent.findUnique({
      where: { id: eventId },
      include: {
        circle: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ message: "Payment event not found" });
    }

    if (event.circle.members.length === 0) {
      return res.status(403).json({
        message: "You must be a circle member to view payouts",
      });
    }

    // Get all payouts for this event
    const payouts = await prisma.payout.findMany({
      where: { paymentEventId: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    const totalPaidOut = payouts
      .filter((p) => ["pending", "in_transit", "paid"].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        requestedAt: p.requestedAt,
        expectedAt: p.expectedAt,
        arrivedAt: p.arrivedAt,
        failureReason: p.failureReason,
        organizer: p.organizer,
      })),
      totalPaidOut,
      currentBalance: event.poolBalance,
    });
  } catch (error: any) {
    console.error("Get payouts error:", error);
    return res.status(500).json({
      message: "Failed to retrieve payouts",
      error: error.message,
    });
  }
});

/**
 * GET /connect/payouts
 * Get all payouts for events the current user organizes
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const payouts = await prisma.payout.findMany({
      where: { organizerId: userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            circle: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    const totalPaidOut = payouts
      .filter((p) => ["paid"].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = payouts
      .filter((p) => ["pending", "in_transit"].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        requestedAt: p.requestedAt,
        expectedAt: p.expectedAt,
        arrivedAt: p.arrivedAt,
        failureReason: p.failureReason,
        event: {
          id: p.event.id,
          title: p.event.title,
        },
        circle: {
          id: p.event.circle.id,
          name: p.event.circle.name,
        },
      })),
      summary: {
        totalPaidOut,
        totalPending,
        totalPayouts: payouts.length,
      },
    });
  } catch (error: any) {
    console.error("Get all payouts error:", error);
    return res.status(500).json({
      message: "Failed to retrieve payouts",
      error: error.message,
    });
  }
});

export { router as payoutRouter };
