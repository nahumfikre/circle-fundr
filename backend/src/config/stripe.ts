import Stripe from "stripe";
import { env } from "./env";

if (!env.stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in your environment");
}

export const stripe = new Stripe(env.stripeSecretKey);
