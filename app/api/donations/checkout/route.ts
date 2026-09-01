import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cleanEmail, cleanText, money } from "@/lib/billing";
import { query } from "@/lib/db";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { createMercadoPagoPreference, mercadoPagoConfigured } from "@/lib/mercado-pago";
import { publicSiteUrl, stripeClient, stripeConfigured } from "@/lib/stripe";
import { failPendingPayment } from "@/lib/payment-processing";

const PURPOSES: Record<string, string> = {
  general: "Apoyo general al Midrash",
  becas: "Becas de estudio",
  libros: "Libros y material de estudio",
  mantenimiento: "Mantenimiento del Midrash",
  eventos: "Eventos comunitarios",
};

export async function POST(req: NextRequest) {
  if (isRateLimited(`donation:${clientIp(req)}`, 12, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }
  const useMercadoPago = mercadoPagoConfigured();
  if (!useMercadoPago && !stripeConfigured()) return NextResponse.json({ error: "Los donativos en línea no están disponibles por el momento." }, { status: 503 });
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") return NextResponse.json({ error: "Inicia sesión con una cuenta aprobada para donar" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const amount = money(body.amount);
  const donorName = cleanText(body.name, 120);
  const donorEmail = cleanEmail(body.email);
  const purposeKey = cleanText(body.purpose, 40);
  const purpose = PURPOSES[purposeKey] || PURPOSES.general;
  const frequency = "one_time";
  if (!amount || amount < 20 || amount > 1_000_000) return NextResponse.json({ error: "El importe debe estar entre $20 y $1,000,000 MXN" }, { status: 400 });
  if (!donorName) return NextResponse.json({ error: "Escribe el nombre del donante" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(donorEmail)) return NextResponse.json({ error: "Escribe un correo válido para enviar el recibo" }, { status: 400 });

  const metadata = { kind: "donation", frequency, purpose: purposeKey };
  const payment = await query<{ id: string }>(
    `INSERT INTO payments
      (user_id, amount, currency, status, payment_method, donor_name, donor_email,
       description, metadata, expires_at)
     VALUES ($1, $2, 'MXN', 'pending', $7, $3, $4, $5, $6, NOW() + INTERVAL '30 minutes')
     RETURNING id`,
    [user.id, amount, donorName, donorEmail, purpose, metadata, useMercadoPago ? "mercadopago" : "stripe"],
  );
  const paymentId = payment.rows[0].id;
  try {
    if (useMercadoPago) {
      const preference = await createMercadoPagoPreference({ paymentId, title: "Donativo a Natán Torá", description: purpose, amount, email: donorEmail, kind: "donation", returnPath: "/donativos" });
      await query("UPDATE payments SET mercadopago_preference_id = $2, updated_at = NOW() WHERE id = $1", [paymentId, preference.id]);
      return NextResponse.json({ url: preference.url, provider: "mercadopago" });
    }
    const stripe = stripeClient();
    const commonMetadata = { payment_id: paymentId, payment_kind: "donation", frequency, purpose: purposeKey };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: donorEmail,
      line_items: [{
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(amount * 100),
          product_data: { name: "Donativo a Natán Torá", description: purpose },
        },
        quantity: 1,
      }],
      metadata: commonMetadata,
      payment_intent_data: { metadata: commonMetadata },
      success_url: `${publicSiteUrl()}/donativos?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicSiteUrl()}/donativos?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, { idempotencyKey: paymentId });
    if (!session.url) throw new Error("Stripe no devolvió la página de pago");
    await query("UPDATE payments SET stripe_session_id = $2, updated_at = NOW() WHERE id = $1", [paymentId, session.id]);
    return NextResponse.json({ url: session.url, provider: "stripe" });
  } catch (error) {
    await failPendingPayment(paymentId).catch(() => undefined);
    console.error("[donations/checkout]", error);
    return NextResponse.json({ error: "No fue posible abrir el pago seguro." }, { status: 500 });
  }
}
