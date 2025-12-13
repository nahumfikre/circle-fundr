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
      // Delete payouts first (they reference payment events)
      prisma.payout.deleteMany({
        where: {
          event: {
            circle: {
              workspaceId: id,
            },
          },
        },
      }),
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

/**
 * POST /workspaces/:id/members
 * Add a member to a workspace by email (admin only)
 *
 * Body: { "email": "user@example.com", "role": "MEMBER" | "ADMIN" }
 */
workspaceRouter.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { email, role } = req.body as { email?: string; role?: "MEMBER" | "ADMIN" };

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if current user is an admin of this workspace
    const currentMember = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: id,
      },
    });

    if (!currentMember || currentMember.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can add members to workspace" });
    }

    // Find the user by email
    const userToAdd = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (!userToAdd) {
      return res.status(404).json({ message: "User with that email not found. They must create an account first." });
    }

    // Check if user is already a member
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: userToAdd.id,
        workspaceId: id,
      },
    });

    if (existingMembership) {
      return res.status(409).json({ message: "User is already a member of this workspace" });
    }

    // Add the user as a member
    const newMember = await prisma.workspaceMember.create({
      data: {
        userId: userToAdd.id,
        workspaceId: id,
        role: role || "MEMBER",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({
      member: {
        id: newMember.user.id,
        name: newMember.user.name,
        email: newMember.user.email,
        role: newMember.role,
      },
    });
  } catch (err) {
    console.error("Add workspace member error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});


export { workspaceRouter };
