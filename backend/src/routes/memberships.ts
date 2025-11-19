import { Router, Request, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

const membershipRouter = Router();

// All membership routes require auth
membershipRouter.use(authMiddleware);

/**
 * Get all members for a circle.
 *
 * GET /memberships/by-circle?circleId=...
 *
 * Response:
 * {
 *   "members": [
 *     { "id": "...", "name": "Nahum", "email": "nahum@example.com" },
 *     ...
 *   ]
 * }
 */
membershipRouter.get(
  "/by-circle",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const circleId = req.query.circleId as string | undefined;

      if (!circleId) {
        res
          .status(400)
          .json({ message: "circleId query param is required" });
        return;
      }

      const memberships = await prisma.membership.findMany({
        where: { circleId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const members = memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      }));

      res.json({ members });
    } catch (err) {
      console.error("Get members by circle error:", err);
      res
        .status(500)
        .json({ message: "Something went wrong loading members" });
    }
  }
);

/**
 * Add an existing user to a circle by email.
 *
 * POST /memberships/circles
 *
 * Body:
 * {
 *   "circleId": "...",
 *   "email": "person@example.com"
 * }
 *
 * Notes:
 * - The user MUST already exist (has registered via auth).
 * - If they are already a member of the circle, we just return that membership.
 */
membershipRouter.post(
  "/circles",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { circleId, email } = req.body as {
        circleId?: string;
        email?: string;
      };

      if (!circleId || !email) {
        res
          .status(400)
          .json({ message: "circleId and email are required" });
        return;
      }

      const circle = await prisma.circle.findUnique({
        where: { id: circleId },
      });

      if (!circle) {
        res.status(404).json({ message: "Circle not found" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        res
          .status(404)
          .json({ message: "User with that email not found" });
        return;
      }

      // Check if membership already exists
      const existing = await prisma.membership.findFirst({
        where: {
          circleId,
          userId: user.id,
        },
      });

      if (existing) {
        res.status(200).json({
          membership: {
            id: existing.id,
            circleId: existing.circleId,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
            },
          },
        });
        return;
      }

      const membership = await prisma.membership.create({
        data: {
          circleId,
          userId: user.id,
        },
      });

      res.status(201).json({
        membership: {
          id: membership.id,
          circleId: membership.circleId,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
      });
    } catch (err) {
      console.error("Create membership error:", err);
      res
        .status(500)
        .json({ message: "Something went wrong adding member" });
    }
  }
);

export { membershipRouter };
