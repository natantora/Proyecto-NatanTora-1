import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { applyBillingPayment } from "@/lib/billing";
import { query, transaction } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.billing_payment_id;
      if (paymentId && session.payment_status === "paid") {
        await transaction((client) => applyBillingPayment(client, paymentId, typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id));
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.billing_payment_id;
      if (paymentId) await query("UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending'", [paymentId]);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook]", event.id, error);
    return NextResponse.json({ error: "No se pudo procesar el evento" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook de Stripe listo" });
}
