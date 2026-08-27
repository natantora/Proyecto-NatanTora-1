import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cleanText } from "@/lib/billing";
import { query, transaction } from "@/lib/db";
import { publicSiteUrl, stripeClient, stripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "El pago con tarjeta no está disponible por el momento." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const requestedIds = Array.isArray(body.charge_ids)
    ? Array.from(new Set(body.charge_ids.map((id: unknown) => cleanText(id, 80)).filter(Boolean))).slice(0, 200)
    : [];
  if (!requestedIds.length) return NextResponse.json({ error: "Selecciona al menos un cargo" }, { status: 400 });
  const siteUrl = publicSiteUrl();
  if (!siteUrl) return NextResponse.json({ error: "La dirección pública del sitio no está configurada" }, { status: 503 });

  let pending: { paymentId: string; amount: number; accountId: string; description: string } | null = null;
  try {
    pending = await transaction(async (client) => {
      const account = await client.query<{ id: string; display_name: string; email: string | null }>(
        `SELECT account.id, account.display_name, account.email
           FROM billing_account_members member
           JOIN billing_accounts account ON account.id = member.account_id AND account.active = TRUE
          WHERE member.profile_id = $1 LIMIT 1`,
        [user.id],
      );
      if (!account.rows[0]) throw new Error("Tu usuario no tiene un estado de cuenta vinculado");
      const charges = await client.query<{ id: string; concept: string; outstanding_amount: string }>(
        `SELECT charge.id, charge.concept, charge.outstanding_amount::text
           FROM billing_charges charge
          WHERE charge.account_id = $1 AND charge.id = ANY($2::uuid[])
            AND charge.status = 'open' AND charge.outstanding_amount > 0
            AND NOT EXISTS (
              SELECT 1 FROM billing_payment_allocations allocation
              JOIN payments payment ON payment.id = allocation.payment_id
              WHERE allocation.charge_id = charge.id AND payment.status = 'pending'
                AND payment.expires_at > NOW()
            )
          ORDER BY charge.due_date NULLS LAST, charge.created_at
          FOR UPDATE`,
        [account.rows[0].id, requestedIds],
      );
      if (charges.rows.length !== requestedIds.length) throw new Error("Uno de los cargos ya fue pagado o tiene un pago en proceso");
      const amount = Math.round(charges.rows.reduce((sum, charge) => sum + Number(charge.outstanding_amount), 0) * 100) / 100;
      if (amount <= 0) throw new Error("El saldo seleccionado ya está cubierto");
      const description = charges.rows.length === 1 ? charges.rows[0].concept : `${charges.rows.length} conceptos del estado de cuenta`;
      const payment = await client.query<{ id: string }>(
        `INSERT INTO payments
          (user_id, billing_account_id, amount, status, payment_method, donor_name,
           donor_email, description, metadata, expires_at)
         VALUES ($1, $2, $3, 'pending', 'stripe', $4, $5, $6,
                 jsonb_build_object('kind', 'billing'), NOW() + INTERVAL '30 minutes')
         RETURNING id`,
        [user.id, account.rows[0].id, amount, account.rows[0].display_name, account.rows[0].email || user.email, description],
      );
      for (const charge of charges.rows) {
        await client.query(
          `INSERT INTO billing_payment_allocations (payment_id, charge_id, amount) VALUES ($1, $2, $3)`,
          [payment.rows[0].id, charge.id, Number(charge.outstanding_amount)],
        );
      }
      return { paymentId: payment.rows[0].id, amount, accountId: account.rows[0].id, description };
    });

    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [{ price_data: { currency: "mxn", unit_amount: Math.round(pending.amount * 100), product_data: { name: "Estado de cuenta NatanTora", description: pending.description } }, quantity: 1 }],
      metadata: { billing_payment_id: pending.paymentId, billing_account_id: pending.accountId },
      payment_intent_data: { metadata: { billing_payment_id: pending.paymentId, billing_account_id: pending.accountId } },
      success_url: `${siteUrl}/mi-cuenta?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/mi-cuenta?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, { idempotencyKey: pending.paymentId });
    if (!session.url) throw new Error("Stripe no devolvió una dirección de pago");
    await query("UPDATE payments SET stripe_session_id = $2 WHERE id = $1", [pending.paymentId, session.id]);
    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    if (pending?.paymentId) await query("UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending'", [pending.paymentId]).catch(() => undefined);
    console.error("[billing/checkout]", error);
    const publicMessages = new Set([
      "Tu usuario no tiene un estado de cuenta vinculado",
      "Uno de los cargos ya fue pagado o tiene un pago en proceso",
      "El saldo seleccionado ya está cubierto",
    ]);
    const message = error instanceof Error && publicMessages.has(error.message)
      ? error.message
      : "El pago con tarjeta no está disponible por el momento.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
