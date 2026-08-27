import Stripe from "stripe";
import { siteOrigin } from "@/lib/site-url";

export function stripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY no está configurada");
  return new Stripe(secret);
}

export function publicSiteUrl(): string {
  return siteOrigin();
}
