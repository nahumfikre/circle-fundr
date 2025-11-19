import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { workspaceRouter } from "./routes/workspaces";
import { circleRouter } from "./routes/circles";
import { membershipRouter } from "./routes/memberships";
import { paymentEventRouter } from "./routes/paymentEvents";
import { paymentRouter } from "./routes/payments";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/workspaces", workspaceRouter);
app.use("/circles", circleRouter);
app.use("/memberships", membershipRouter);
app.use("/payment-events", paymentEventRouter);
app.use("/payments", paymentRouter);

export { app };

