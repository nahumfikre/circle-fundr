import Stripe from "stripe";
import { env } from "./env";

if (!env.stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in your environment");
}

// If TS complains about apiVersion string, you can remove the apiVersion line.
export const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: "2023-10-16",
});
