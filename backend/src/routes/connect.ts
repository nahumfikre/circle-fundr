import { Router, Request, Response } from "express";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import prisma from "../config/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// All Connect routes require authentication
router.use(authMiddleware);

/**
 * POST /connect/onboard
 * Create or retrieve Stripe Connect account and generate onboarding link
 */
router.post("/onboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let accountId = user.stripeAccountId;

    // Create Connect account if it doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
      });

      accountId = account.id;

      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeAccountId: accountId,
          stripeOnboardingStatus: "pending",
        },
      });
    }

    // Generate account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${env.frontendUrl}/connect/refresh`,
      return_url: `${env.frontendUrl}/dashboard`,
      type: "account_onboarding",
    });

    return res.json({
      accountId,
      onboardingUrl: accountLink.url,
      status: user.stripeOnboardingStatus || "pending",
    });
  } catch (error: any) {
    console.error("Connect onboarding error:", error);
    return res.status(500).json({
      message: "Failed to create onboarding link",
      error: error.message,
    });
  }
});

/**
 * GET /connect/status
 * Get user's Stripe Connect account status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeAccountId: true,
        stripeOnboardingStatus: true,
        stripeDetailsSubmitted: true,
        stripePayoutsEnabled: true,
        stripeOnboardedAt: true,
      },
    });

    if (!user || !user.stripeAccountId) {
      return res.json({
        connected: false,
        accountId: null,
        status: null,
        payoutsEnabled: false,
        onboardedAt: null,
      });
    }

    // Fetch latest status from Stripe
    try {
      const account = await stripe.accounts.retrieve(user.stripeAccountId);

      // Update local status if different
      if (
        account.details_submitted !== user.stripeDetailsSubmitted ||
        account.payouts_enabled !== user.stripePayoutsEnabled
      ) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeDetailsSubmitted: account.details_submitted || false,
            stripePayoutsEnabled: account.payouts_enabled || false,
            stripeOnboardingStatus: account.details_submitted
              ? "complete"
              : "pending",
            stripeOnboardedAt:
              account.details_submitted && !user.stripeOnboardedAt
                ? new Date()
                : user.stripeOnboardedAt,
          },
        });
      }

      return res.json({
        connected: true,
        accountId: user.stripeAccountId,
        status: account.details_submitted ? "complete" : "pending",
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        onboardedAt: user.stripeOnboardedAt,
      });
    } catch (stripeError: any) {
      // If account doesn't exist in Stripe anymore, clear local data
      if (stripeError.code === "resource_missing") {
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeAccountId: null,
            stripeOnboardingStatus: null,
            stripeDetailsSubmitted: false,
            stripePayoutsEnabled: false,
            stripeOnboardedAt: null,
          },
        });

        return res.json({
          connected: false,
          accountId: null,
          status: null,
          payoutsEnabled: false,
          onboardedAt: null,
        });
      }

      throw stripeError;
    }
  } catch (error: any) {
    console.error("Connect status error:", error);
    return res.status(500).json({
      message: "Failed to retrieve Connect status",
      error: error.message,
    });
  }
});

/**
 * POST /connect/refresh
 * Regenerate onboarding link if user exited the flow
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.stripeAccountId) {
      return res.status(400).json({
        message: "No Connect account exists. Please start onboarding first.",
      });
    }

    // Generate new account link
    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: `${env.frontendUrl}/connect/refresh`,
      return_url: `${env.frontendUrl}/dashboard`,
      type: "account_onboarding",
    });

    return res.json({
      accountId: user.stripeAccountId,
      onboardingUrl: accountLink.url,
      status: user.stripeOnboardingStatus || "pending",
    });
  } catch (error: any) {
    console.error("Connect refresh error:", error);
    return res.status(500).json({
      message: "Failed to refresh onboarding link",
      error: error.message,
    });
  }
});

/**
 * GET /connect/dashboard
 * Generate Stripe Express Dashboard login link for connected accounts
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeAccountId) {
      return res.status(400).json({
        message: "No Connect account found. Please complete onboarding first.",
      });
    }

    if (!user.stripeDetailsSubmitted) {
      return res.status(400).json({
        message: "Please complete onboarding before accessing the dashboard.",
      });
    }

    // Generate login link to Stripe Express Dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      user.stripeAccountId
    );

    return res.json({
      dashboardUrl: loginLink.url,
    });
  } catch (error: any) {
    console.error("Connect dashboard error:", error);
    return res.status(500).json({
      message: "Failed to generate dashboard link",
      error: error.message,
    });
  }
});

export { router as connectRouter };
