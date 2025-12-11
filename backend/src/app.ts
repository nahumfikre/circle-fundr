import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import { authRouter } from "./routes/auth";
import { workspaceRouter } from "./routes/workspaces";
import { circleRouter } from "./routes/circles";
import { membershipRouter } from "./routes/memberships";
import { paymentEventRouter } from "./routes/paymentEvents";
import { paymentRouter } from "./routes/payments";
import { webhookRouter } from "./routes/webhooks";
import { connectRouter } from "./routes/connect";
import { payoutRouter } from "./routes/payouts";
import { env } from "./config/env";

const app = express();

// Security: Add security headers
app.use(helmet());

// Security: Configure CORS to only allow your frontend
const corsOptions = {
  origin: env.frontendUrl,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Security: Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(passport.initialize());

// Parse cookies for authentication
app.use(cookieParser());

// Webhook routes need raw body for Stripe signature verification
// Must be registered BEFORE express.json()
app.use(
  "/webhooks",
  express.raw({ type: "application/json" }),
  webhookRouter
);

// Parse JSON for all other routes with size limit
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/workspaces", workspaceRouter);
app.use("/circles", circleRouter);
app.use("/memberships", membershipRouter);
app.use("/payment-events", paymentEventRouter);
app.use("/payments", paymentRouter);
app.use("/connect", connectRouter);
app.use("/payouts", payoutRouter);

export { app };

