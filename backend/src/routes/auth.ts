import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { promises as dns } from "dns";
import prisma from "../config/prisma";
import passport from "../config/passport";
import { env } from "../config/env";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "../services/email";
import {
  authLimiter,
  verificationLimiter,
  resendLimiter,
} from "../middleware/rateLimiter";

const router = Router();

// List of common disposable/fake email domains to block
const disposableEmailDomains = [
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "mailinator.com",
  "10minutemail.com",
  "trashmail.com",
  "fakeinbox.com",
  "notreal.com",
  "fake.com",
  "test.com",
  "example.com",
];

async function isValidEmailDomain(email: string): Promise<boolean> {
  try {
    const domain = email.split("@")[1].toLowerCase();

    // Check if domain is in disposable list
    if (disposableEmailDomains.includes(domain)) {
      return false;
    }

    // Check if domain has valid MX records (can receive emails)
    const mxRecords = await dns.resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch (error) {
    // If DNS lookup fails, domain doesn't exist or can't receive emails
    return false;
  }
}

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }

  return { valid: true };
}

function signToken(userId: string) {
  return jwt.sign(
    { userId },
    env.jwtSecret,
    {
      expiresIn: "2h", // 2 hours for security
    }
  );
}

function setTokenCookie(res: Response, token: string) {
  res.cookie("access_token", token, {
    httpOnly: true, // Prevents XSS attacks
    secure: env.isProduction, // HTTPS only in production
    sameSite: env.isProduction ? "none" : "lax", // "none" for cross-site in production
    maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  });
}

// POST /auth/register
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });
    }

    // Validate password complexity
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res
        .status(400)
        .json({ message: passwordValidation.message });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address" });
    }

    // Validate email domain exists and can receive emails
    const isValidDomain = await isValidEmailDomain(email);
    if (!isValidDomain) {
      return res
        .status(400)
        .json({ message: "Please use a valid email address from a real domain" });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    // If user exists and email is already verified, don't allow re-registration
    if (existing && existing.emailVerified) {
      return res
        .status(409)
        .json({ message: "A user with that email already exists" });
    }

    // If user exists but email is NOT verified, delete the old unverified account
    if (existing && !existing.emailVerified) {
      await prisma.user.delete({
        where: { email },
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Generate verification code (6 digits)
    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        emailVerified: false,
        verificationCode,
        verificationExpiry,
      },
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationCode, name);

    if (!emailSent) {
      console.error("Failed to send verification email to:", email);
      // In production, auto-verify if email can't be sent (SMTP blocked)
      if (env.isProduction) {
        console.log("⚠️  Auto-verifying user in production due to email delivery failure");
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });

        const token = signToken(user.id);
        setTokenCookie(res, token);

        return res.status(201).json({
          message: "Account created! (Email verification bypassed)",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: true,
          },
        });
      }

      // In development, fail if email can't be sent
      await prisma.user.delete({
        where: { id: user.id },
      });
      return res.status(500).json({
        message: "Failed to send verification email. Please try again.",
      });
    }

    // Don't return a token yet - user needs to verify email first
    return res.status(201).json({
      message: "Account created! Please check your email for a verification code.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: false,
      },
      requiresVerification: true,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /auth/login
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = signToken(user.id);
    setTokenCookie(res, token);

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /auth/verify-email
router.post("/verify-email", verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body as {
      email?: string;
      code?: string;
    };

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (!user.verificationCode || !user.verificationExpiry) {
      return res.status(400).json({ message: "No verification code found" });
    }

    // Check if code has expired
    if (new Date() > user.verificationExpiry) {
      return res.status(400).json({ message: "Verification code has expired" });
    }

    // Check if code matches
    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Mark email as verified
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationExpiry: null,
      },
    });

    const token = signToken(user.id);
    setTokenCookie(res, token);

    return res.status(200).json({
      message: "Email verified successfully!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// POST /auth/resend-verification
router.post("/resend-verification", resendLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        verificationCode,
        verificationExpiry,
      },
    });

    // Send new verification email
    await sendVerificationEmail(email, verificationCode, user.name);

    return res.status(200).json({
      message: "Verification code sent! Check your email.",
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// GET /auth/google
router.get("/google", (req: Request, res: Response, next) => {
  if (!env.googleClientId || !env.googleClientSecret ||
      env.googleClientId === "your_google_client_id_here") {
    return res.status(503).json({
      message: "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file."
    });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
  })(req, res, next);
});

// GET /auth/google/callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.frontendUrl}/login` }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.redirect(`${env.frontendUrl}/login?error=auth_failed`);
      }

      const token = signToken(user.id);
      setTokenCookie(res, token);

      res.redirect(`${env.frontendUrl}/auth/callback`);
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${env.frontendUrl}/login?error=auth_failed`);
    }
  }
);

// POST /auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
  });
  return res.status(200).json({ message: "Logged out successfully" });
});

export { router as authRouter };

