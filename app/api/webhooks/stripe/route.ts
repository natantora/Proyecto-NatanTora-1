import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { failCheckoutSession, finalizeCheckoutSession, recordRecurringDonation } from "@/lib/payment-processing";
import { stripeClient } from "@/lib/stripe";
import { reportSystemAlert } from "@/lib/system-alerts";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    await reportSystemAlert({ severity: "warning", category: "webhook", title: "Notificación de Stripe rechazada", message: "Llegó una notificación con firma inválida. No se modificó ningún pago.", fingerprint: "webhook:stripe:invalid-signature" });
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await finalizeCheckoutSession(session);
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await failCheckoutSession(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "invoice.paid") {
      await recordRecurringDonation(event.data.object as Stripe.Invoice);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook]", event.id, error);
    await reportSystemAlert({ severity: "critical", category: "webhook", title: "No se pudo procesar un evento de Stripe", message: error instanceof Error ? error.message : String(error), fingerprint: `webhook:stripe:processing:${event.id}`, context: { event_id: event.id, event_type: event.type } });
    return NextResponse.json({ error: "No se pudo procesar el evento" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook de Stripe listo" });
}
