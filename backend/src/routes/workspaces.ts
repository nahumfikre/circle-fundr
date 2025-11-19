import { Router, Request, Response } from "express";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

const workspaceRouter = Router();

// All workspace routes require authentication
workspaceRouter.use(authMiddleware);

/**
 * Create a workspace
 */
workspaceRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Workspace name is required" });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        members: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
      },
      include: {
        members: true,
      },
    });

    return res.status(201).json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.createdAt,
        role: "ADMIN",
      },
    });
  } catch (err) {
    console.error("Create workspace error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /workspaces/:id/invite-code
workspaceRouter.post("/:id/invite-code", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const member = await prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: id },
    });

    if (!member || member.role !== "ADMIN") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const code = "w_" + Math.random().toString(36).substring(2, 12);

    const workspace = await prisma.workspace.update({
      where: { id },
      data: { inviteCode: code },
    });

    return res.json({ inviteCode: workspace.inviteCode });
  } catch (err) {
    console.error("Invite code error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /workspaces/join
workspaceRouter.post("/join", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: "inviteCode is required" });
    }

    const workspace = await prisma.workspace.findFirst({
      where: { inviteCode },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: workspace.id },
    });

    if (existing) {
      return res.status(409).json({ message: "Already in workspace" });
    }

    await prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: "MEMBER",
      },
    });

    return res.json({ message: "Joined workspace successfully" });
  } catch (err) {
    console.error("Join workspace error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * List all workspaces the user is a member of
 */
workspaceRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      createdAt: m.workspace.createdAt,
      role: m.role,
    }));

    return res.status(200).json({ workspaces });
  } catch (err) {
    console.error("List workspaces error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * Get a specific workspace
 */
workspaceRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    const member = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: id,
      },
      include: {
        workspace: true,
      },
    });

    if (!member) {
      return res
        .status(404)
        .json({ message: "Workspace not found or access denied" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
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
        },
      },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    return res.status(200).json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.createdAt,
        role: member.role,
        members: workspace.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        })),
      },
    });
  } catch (err) {
    console.error("Get workspace error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

/**
 * DELETE /workspaces/:id
 *
 * Delete a workspace and all related data:
 * - circles in the workspace
 * - memberships in those circles
 * - payment events for those circles
 * - payments for those events
 * - workspace membership rows
 * - the workspace itself
 *
 * Only admins of the workspace can do this.
 */
workspaceRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    const member = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: id,
      },
    });

    if (!member || member.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can delete workspaces" });
    }

    await prisma.$transaction([
      // Delete payments linked to events in any circle in this workspace
      prisma.payment.deleteMany({
        where: {
          event: {
            circle: {
              workspaceId: id,
            },
          },
        },
      }),
      // Delete payment events in circles of this workspace
      prisma.paymentEvent.deleteMany({
        where: {
          circle: {
            workspaceId: id,
          },
        },
      }),
      // Delete memberships in circles of this workspace
      prisma.membership.deleteMany({
        where: {
          circle: {
            workspaceId: id,
          },
        },
      }),
      // Delete circles
      prisma.circle.deleteMany({
        where: {
          workspaceId: id,
        },
      }),
      // Delete workspace members
      prisma.workspaceMember.deleteMany({
        where: {
          workspaceId: id,
        },
      }),
      // Finally delete the workspace
      prisma.workspace.delete({
        where: { id },
      }),
    ]);

    return res.json({ message: "Workspace deleted" });
  } catch (err) {
    console.error("Delete workspace error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// DELETE /workspaces/:id
// Only workspace ADMIN can delete. This will delete the workspace,
// its circles, memberships, payment events, and payments.
workspaceRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    // Make sure workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check that the user is an admin in this workspace
    const member = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: id,
      },
    });

    if (!member || member.role !== "ADMIN") {
      return res.status(403).json({ message: "Only workspace admins can delete workspaces" });
    }

    // Find all circles in this workspace
    const circles = await prisma.circle.findMany({
      where: { workspaceId: id },
      select: { id: true },
    });
    const circleIds = circles.map((c) => c.id);

    // Find all events for those circles
    const events = await prisma.paymentEvent.findMany({
      where: {
        circleId: { in: circleIds },
      },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);

    // Delete everything in a transaction
    await prisma.$transaction([
      // payments tied to those events
      prisma.payment.deleteMany({
        where: {
          paymentEventId: { in: eventIds },
        },
      }),
      // events
      prisma.paymentEvent.deleteMany({
        where: {
          circleId: { in: circleIds },
        },
      }),
      // circle memberships
      prisma.membership.deleteMany({
        where: {
          circleId: { in: circleIds },
        },
      }),
      // circles
      prisma.circle.deleteMany({
        where: {
          id: { in: circleIds },
        },
      }),
      // workspace members
      prisma.workspaceMember.deleteMany({
        where: {
          workspaceId: id,
        },
      }),
      // workspace itself
      prisma.workspace.delete({
        where: { id },
      }),
    ]);

    return res.status(200).json({ message: "Workspace deleted" });
  } catch (err) {
    console.error("Delete workspace error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});


export { workspaceRouter };
