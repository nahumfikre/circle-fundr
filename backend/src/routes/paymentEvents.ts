import { Router, Request, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

const paymentEventRouter = Router();

// All payment event routes require auth
paymentEventRouter.use(authMiddleware);

/**
 * Check if user is a member of the circle
 * Any circle member can create payment events and become the organizer
 */
async function ensureCircleMembership(userId: string, circleId: string) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_circleId: {
        userId,
        circleId,
      },
    },
    include: {
      circle: true,
    },
  });

  if (!membership) {
    return {
      ok: false as const,
      status: 403,
      message: "You must be a circle member to create payment events",
    };
  }

  return {
    ok: true as const,
    membership,
    circle: membership.circle,
  };
}

/**
 * POST /payment-events
 *
 * Creates a dues / payment event for a circle
 * AND auto-creates a Payment record for every member in that circle.
 *
 * Body:
 * {
 *   "title": "Housing",
 *   "amount": 120,
 *   "dueDate": "2025-03-01",
 *   "circleId": "..."
 * }
 */
paymentEventRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { title, amount, dueDate, circleId } = req.body as {
      title?: string;
      amount?: number;
      dueDate?: string;
      circleId?: string;
    };

    if (!title || !amount || !dueDate || !circleId) {
      return res.status(400).json({
        message: "title, amount, dueDate, and circleId are required",
      });
    }

    const cleanTitle = title.trim();
    const amountNumber = Number(amount);

    if (!cleanTitle) {
      return res.status(400).json({ message: "title cannot be empty" });
    }

    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      return res
        .status(400)
        .json({ message: "amount must be a positive number" });
    }

    const parsedDate = new Date(dueDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "dueDate must be a valid date" });
    }

    // Make sure requester is a member of the circle
    const check = await ensureCircleMembership(userId, circleId);

    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    // Create the payment event with current user as organizer
    const event = await prisma.paymentEvent.create({
      data: {
        title: cleanTitle,
        amount: amountNumber,
        dueDate: parsedDate,
        circleId,
        organizerId: userId, // Current user becomes the organizer
        poolBalance: 0, // Initialize pool balance
      },
    });

    // Link every member in the circle to this event with a PENDING payment
    const memberships = await prisma.membership.findMany({
      where: { circleId },
      select: { id: true },
    });

    if (memberships.length > 0) {
      await prisma.payment.createMany({
        data: memberships.map((m) => ({
          status: "PENDING",
          amountPaid: 0,
          method: "MANUAL",
          paymentEventId: event.id,
          membershipId: m.id,
        })),
      });
    }

    return res.status(201).json({ event });
  } catch (err) {
    console.error("Create payment event error:", err);
    return res
      .status(500)
      .json({ message: "Something went wrong creating payment event" });
  }
});

/**
 * GET /payment-events/by-circle?circleId=...
 *
 * Returns all dues events for a circle.
 * Shape:
 * { "events": [ { id, title, amount, dueDate, createdAt }, ... ] }
 */
paymentEventRouter.get(
  "/by-circle",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const circleId = req.query.circleId as string | undefined;

      if (!circleId) {
        res.status(400).json({ message: "circleId query param is required" });
        return;
      }

      const events = await prisma.paymentEvent.findMany({
        where: { circleId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          amount: true,
          dueDate: true,
          createdAt: true,
        },
      });

      res.json({ events });
    } catch (err) {
      console.error("Get payment events by circle error:", err);
      res
        .status(500)
        .json({ message: "Something went wrong loading payment events" });
    }
  }
);

export { paymentEventRouter };
