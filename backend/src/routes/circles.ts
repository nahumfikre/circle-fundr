import { Router, Request, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

const circleRouter = Router();

// All circle routes require auth
circleRouter.use(authMiddleware);

async function ensureWorkspaceMember(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
    },
  });

  if (!membership) {
    return {
      ok: false as const,
      status: 403,
      message: "You do not belong to this workspace",
    };
  }

  return {
    ok: true as const,
    role: membership.role as "ADMIN" | "MEMBER",
  };
}

async function ensureWorkspaceAdmin(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
    },
  });

  if (!membership) {
    return {
      ok: false as const,
      status: 403,
      message: "You do not belong to this workspace",
    };
  }

  if (membership.role !== "ADMIN") {
    return {
      ok: false as const,
      status: 403,
      message: "Only admins can manage circles",
    };
  }

  return { ok: true as const };
}

/**
 * POST /circles
 *
 * Create a circle inside a workspace.
 * Body:
 * {
 *   "name": "Spring Trip 2025",
 *   "description": "Main group for the trip",
 *   "workspaceId": "..."
 * }
 *
 * The creator is automatically added as a member of the circle.
 */
circleRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { name, description, workspaceId } = req.body as {
      name?: string;
      description?: string | null;
      workspaceId?: string;
    };

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Circle name is required" });
    }

    // Make sure the user belongs to this workspace
    const check = await ensureWorkspaceMember(userId, workspaceId);

    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const circle = await prisma.circle.create({
      data: {
        name: name.trim(),
        description:
          description && description.trim().length > 0
            ? description.trim()
            : null,
        workspaceId,
      },
    });

    // Make sure the creator is a member of the circle
    await prisma.membership.create({
      data: {
        userId,
        circleId: circle.id,
      },
    });

    return res.status(201).json({
      circle: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        workspaceId: circle.workspaceId,
        createdAt: circle.createdAt,
      },
    });
  } catch (err) {
    console.error("Create circle error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * GET /circles/by-workspace?workspaceId=...
 *
 * List all circles in a workspace that the user belongs to.
 * (We only check that the user is a member of the workspace, not each circle.)
 *
 * Response:
 * {
 *   "circles": [
 *     { "id", "name", "description", "workspaceId", "createdAt" },
 *     ...
 *   ]
 * }
 */
circleRouter.get("/by-workspace", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const workspaceId = req.query.workspaceId as string | undefined;

    if (!workspaceId) {
      return res
        .status(400)
        .json({ message: "workspaceId query param is required" });
    }

    const check = await ensureWorkspaceMember(userId, workspaceId);

    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const circles = await prisma.circle.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        workspaceId: true,
        createdAt: true,
      },
    });

    return res.json({ circles });
  } catch (err) {
    console.error("Get circles by workspace error:", err);
    return res
      .status(500)
      .json({ message: "Something went wrong loading circles" });
  }
});

/**
 * GET /circles/:id
 *
 * Fetch a single circle.
 */
circleRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    const circle = await prisma.circle.findUnique({
      where: { id },
      include: {
        workspace: true,
      },
    });

    if (!circle) {
      return res.status(404).json({ message: "Circle not found" });
    }

    const check = await ensureWorkspaceMember(userId, circle.workspaceId);

    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    return res.json({
      circle: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        workspaceId: circle.workspaceId,
        createdAt: circle.createdAt,
      },
    });
  } catch (err) {
    console.error("Get circle error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * DELETE /circles/:id
 *
 * Delete a circle and all related data:
 * - payments for its events
 * - payment events
 * - memberships
 * - the circle itself
 *
 * Only workspace admins can do this.
 */
circleRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    const circle = await prisma.circle.findUnique({
      where: { id },
      include: {
        workspace: true,
      },
    });

    if (!circle) {
      return res.status(404).json({ message: "Circle not found" });
    }

    const adminCheck = await ensureWorkspaceAdmin(userId, circle.workspaceId);

    if (!adminCheck.ok) {
      return res
        .status(adminCheck.status)
        .json({ message: adminCheck.message });
    }

    await prisma.$transaction([
      // Delete payments tied to this circle's events
      prisma.payment.deleteMany({
        where: {
          membership: {
            circleId: id,
          },
        },
      }),
      prisma.paymentEvent.deleteMany({
        where: {
          circleId: id,
        },
      }),
      prisma.membership.deleteMany({
        where: {
          circleId: id,
        },
      }),
      prisma.circle.delete({
        where: { id },
      }),
    ]);

    return res.json({ message: "Circle deleted" });
  } catch (err) {
    console.error("Delete circle error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /circles/:id
// Only a workspace ADMIN can delete a circle.
// This also cleans up memberships, payment events, and payments for that circle.
circleRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    // Find the circle and its workspace
    const circle = await prisma.circle.findUnique({
      where: { id },
    });

    if (!circle) {
      return res.status(404).json({ message: "Circle not found" });
    }

    // Make sure the user is an admin in that workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: circle.workspaceId,
      },
    });

    if (!membership || membership.role !== "ADMIN") {
      return res.status(403).json({ message: "Only workspace admins can delete circles" });
    }

    // Get all events for this circle
    const events = await prisma.paymentEvent.findMany({
      where: { circleId: id },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);

    // Delete everything tied to this circle in a transaction
    await prisma.$transaction([
      prisma.payment.deleteMany({
        where: {
          paymentEventId: { in: eventIds },
        },
      }),
      prisma.paymentEvent.deleteMany({
        where: { circleId: id },
      }),
      prisma.membership.deleteMany({
        where: { circleId: id },
      }),
      prisma.circle.delete({
        where: { id },
      }),
    ]);

    return res.status(200).json({ message: "Circle deleted" });
  } catch (err) {
    console.error("Delete circle error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});


export { circleRouter };
