import dotenv from "dotenv";

dotenv.config();

const port = process.env.PORT || "4000";
const jwtSecret = process.env.JWT_SECRET || "change-me";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const env = {
  port: parseInt(port, 10),
  jwtSecret,
  databaseUrl: process.env.DATABASE_URL,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,   // ⬅️ new
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000", // ⬅️ new
};
