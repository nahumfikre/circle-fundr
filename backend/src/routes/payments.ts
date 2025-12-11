import { Router, Request, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";
import { stripe } from "../config/stripe";
import { env } from "../config/env";

const paymentRouter = Router();

// All payment routes require auth
paymentRouter.use(authMiddleware);

function getUserId(req: Request): string {
  return (req as any).userId as string;
}

// Helper: ensure the current user is a member of the circle for this event
async function ensureCircleMembership(userId: string, circleId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_circleId: {
        userId,
        circleId,
      },
    },
  });

  if (!membership) {
    return {
      ok: false as const,
      status: 403,
      message: "You are not a member of this circle",
    };
  }

  return { ok: true as const, membership };
}

// Helper: ensure current user is an ADMIN of the workspace that owns this circle
async function ensureWorkspaceAdmin(userId: string, workspaceId: string) {
  const wm = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });

  if (!wm || wm.role !== "ADMIN") {
    return {
      ok: false as const,
      status: 403,
      message: "You must be a workspace admin to perform this action",
    };
  }

  return { ok: true as const, workspaceMember: wm };
}

// GET /payments/by-event/:eventId
// Returns the event + all payments for everyone in the circle.
// Also makes sure Payment rows exist (one per member of the circle).
paymentRouter.get("/by-event/:eventId", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = getUserId(req);

    const event = await prisma.paymentEvent.findUnique({
      where: { id: eventId },
      include: {
        circle: {
          include: {
            workspace: true,
          },
        },
        organizer: true,
        payouts: true,
      },
    });

    if (!event) {
      return res.status(404).json({ message: "Payment event not found" });
    }

    // Make sure the current user actually belongs to this circle
    const membershipCheck = await ensureCircleMembership(userId, event.circleId);
    if (!membershipCheck.ok) {
      return res
        .status(membershipCheck.status)
        .json({ message: membershipCheck.message });
    }

    // Check if user is workspace admin
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: event.circle.workspaceId,
        },
      },
    });
    const isAdmin = workspaceMember?.role === "ADMIN";

    // Load all circle memberships so we can guarantee one Payment per member
    const circleMemberships = await prisma.membership.findMany({
      where: { circleId: event.circleId },
      include: { user: true },
    });

    // Ensure there is a Payment row for each membership
    for (const m of circleMemberships) {
      await prisma.payment.upsert({
        where: {
          paymentEventId_membershipId: {
            paymentEventId: event.id,
            membershipId: m.id,
          },
        },
        update: {},
        create: {
          paymentEventId: event.id,
          membershipId: m.id,
          amountPaid: 0,
          method: "STRIPE",
          status: "PENDING",
        },
      });
    }

    const payments = await prisma.payment.findMany({
      where: { paymentEventId: event.id },
      include: {
        membership: {
          include: {
            user: true,
            circle: {
              include: { workspace: true },
            },
          },
        },
        event: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Calculate pool statistics
    const totalPaidIn = payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amountPaid, 0);

    const totalPaidOut = event.payouts
      .filter((p) => ["pending", "in_transit", "paid"].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      event: {
        id: event.id,
        title: event.title,
        amount: event.amount,
        dueDate: event.dueDate,
        circleId: event.circleId,
        createdAt: event.createdAt,
      },
      circle: {
        id: event.circle.id,
        name: event.circle.name,
        workspaceId: event.circle.workspaceId,
        workspaceName: event.circle.workspace.name,
      },
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        amountPaid: p.amountPaid,
        method: p.method,
        paidAt: p.paidAt,
        user: {
          id: p.membership.user.id,
          name: p.membership.user.name,
          email: p.membership.user.email,
        },
      })),
      poolInfo: {
        balance: event.poolBalance,
        totalPaidIn,
        totalPaidOut,
        organizerId: event.organizerId,
        organizerName: event.organizer.name,
        organizerOnboarded: event.organizer.stripePayoutsEnabled,
      },
      currentUserId: userId,
      isAdmin,
      isOrganizer: userId === event.organizerId,
    });
  } catch (err) {
    console.error("Error loading payments by event:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /payments/:paymentId/mark-paid
// Manual override for admins (for cash/Venmo/etc.)
// Body: { amount: number }
paymentRouter.post(
  "/:paymentId/mark-paid",
  async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;
      const userId = getUserId(req);
      const { amount } = req.body as { amount?: number };

      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Amount must be specified and greater than zero" });
      }

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          event: {
            include: {
              circle: {
                include: {
                  workspace: true,
                },
              },
            },
          },
          membership: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const workspaceId = payment.event.circle.workspaceId;
      const adminCheck = await ensureWorkspaceAdmin(userId, workspaceId);

      if (!adminCheck.ok) {
        return res
          .status(adminCheck.status)
          .json({ message: adminCheck.message });
      }

      // Add the manual amount to existing amount paid
      const newAmountPaid = payment.amountPaid + amount;

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          method: "MANUAL",
          paidAt: new Date(),
          amountPaid: newAmountPaid,
          // Store the manual amount so we can undo it later
          stripeIntentId: `manual_${amount}`,
        },
        include: {
          membership: {
            include: { user: true },
          },
          event: true,
        },
      });

      return res.json({
        id: updated.id,
        status: updated.status,
        amountPaid: updated.amountPaid,
        method: updated.method,
        paidAt: updated.paidAt,
      });
    } catch (err) {
      console.error("Error marking payment as paid:", err);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
);

// POST /payments/:paymentId/undo-manual
// Undo a manual payment (admin only)
paymentRouter.post(
  "/:paymentId/undo-manual",
  async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;
      const userId = getUserId(req);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          event: {
            include: {
              circle: {
                include: {
                  workspace: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const workspaceId = payment.event.circle.workspaceId;
      const adminCheck = await ensureWorkspaceAdmin(userId, workspaceId);

      if (!adminCheck.ok) {
        return res
          .status(adminCheck.status)
          .json({ message: adminCheck.message });
      }

      // Check if this was a manual payment
      if (payment.method !== "MANUAL" || !payment.stripeIntentId?.startsWith("manual_")) {
        return res.status(400).json({ message: "This payment was not manually marked as paid" });
      }

      // Extract the manual amount from stripeIntentId
      const manualAmount = parseFloat(payment.stripeIntentId.replace("manual_", ""));
      const newAmountPaid = Math.max(0, payment.amountPaid - manualAmount);

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING",
          method: "STRIPE",
          paidAt: null,
          amountPaid: newAmountPaid,
          stripeIntentId: null,
        },
      });

      return res.json({
        id: updated.id,
        status: updated.status,
        amountPaid: updated.amountPaid,
        method: updated.method,
        paidAt: updated.paidAt,
      });
    } catch (err) {
      console.error("Error undoing manual payment:", err);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
);

// POST /payments/:paymentId/create-checkout-session
// Creates a Stripe Checkout Session for the current user to pay their share.
// Now supports partial payments via `amount` in the request body.
paymentRouter.post(
  "/:paymentId/create-checkout-session",
  async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res
          .status(500)
          .json({ message: "Stripe is not configured on the server" });
      }

      const { paymentId } = req.params;
      const userId = getUserId(req);
      const { amount } = req.body as { amount?: number };

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          event: {
            include: {
              circle: {
                include: {
                  workspace: true,
                },
              },
            },
          },
          membership: {
            include: {
              user: true,
              circle: true,
            },
          },
        },
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Only the user assigned to this payment can pay it
      if (payment.membership.userId !== userId) {
        return res.status(403).json({
          message: "You are not allowed to pay for this member's share",
        });
      }

      const event = payment.event;
      const circle = payment.membership.circle;
      const workspace = event.circle.workspace;

      // Determine charge amount - user can specify any amount
      let chargeAmount = amount;

      if (typeof chargeAmount !== "number" || chargeAmount <= 0) {
        return res
          .status(400)
          .json({ message: "Amount must be specified and greater than zero" });
      }

      const amountInCents = Math.round(chargeAmount * 100);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountInCents,
              product_data: {
                name: `${event.title} - ${circle.name}`,
                description: `Circle: ${circle.name} · Workspace: ${workspace.name}`,
              },
            },
          },
        ],
        customer_email: payment.membership.user.email,
        metadata: {
          paymentId: payment.id,
          paymentEventId: payment.paymentEventId,
          membershipId: payment.membershipId,
          userId,
          chargeAmount: String(chargeAmount),
        },
        success_url: `${env.frontendUrl}/payment-events/${event.id}?success=true`,
        cancel_url: `${env.frontendUrl}/payment-events/${event.id}?canceled=true`,
      });

      // Store the Stripe session id on the payment row
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeIntentId: session.id,
          status: "PENDING",
          method: "STRIPE",
        },
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error("Error creating Stripe Checkout session:", err);
      return res
        .status(500)
        .json({ message: "Something went wrong creating checkout session" });
    }
  }
);

export { paymentRouter };
