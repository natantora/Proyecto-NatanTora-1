import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { applyBillingPayment } from "@/lib/billing";
import { query, transaction } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { sendPaymentReceipt } from "@/lib/transactional-emails";

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
        const applied = await transaction((client) => applyBillingPayment(client, paymentId, typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id));
        if (applied) {
          const receipt = await query<{
            amount: string;
            email: string | null;
            member_name: string;
            paid_at: Date | null;
            concepts: string[];
            remaining_balance: string;
          }>(
            `SELECT payment.amount::text,
                    COALESCE(payment.donor_email, account.email) AS email,
                    COALESCE(payment.donor_name, account.display_name, 'Miembro') AS member_name,
                    payment.paid_at,
                    ARRAY(
                      SELECT charge.concept
                        FROM billing_payment_allocations allocation
                        JOIN billing_charges charge ON charge.id = allocation.charge_id
                       WHERE allocation.payment_id = payment.id
                       ORDER BY charge.created_at
                    ) AS concepts,
                    COALESCE((
                      SELECT SUM(charge.outstanding_amount)
                        FROM billing_charges charge
                       WHERE charge.account_id = payment.billing_account_id
                         AND charge.status = 'open'
                    ), 0)::text AS remaining_balance
               FROM payments payment
          LEFT JOIN billing_accounts account ON account.id = payment.billing_account_id
              WHERE payment.id = $1`,
            [paymentId],
          );
          const data = receipt.rows[0];
          if (data?.email) {
            await sendPaymentReceipt({
              email: data.email,
              memberName: data.member_name,
              amount: Number(data.amount),
              method: "stripe",
              concepts: data.concepts ?? [],
              remainingBalance: Number(data.remaining_balance),
              paidAt: data.paid_at ?? new Date(),
            }).catch((emailError) => console.error("[stripe/webhook] receipt email failed:", emailError));
          }
        }
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
