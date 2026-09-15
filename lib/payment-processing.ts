import type Stripe from "stripe";
import { applyBillingPayment } from "@/lib/billing";
import { query, transaction } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { sendDonationReceipt, sendPaymentFailure, sendPaymentReceipt, sendReservationConfirmation } from "@/lib/transactional-emails";
import { recordFinancialAudit } from "@/lib/financial-audit";
import { reportEmailFailure } from "@/lib/system-alerts";

type PaymentKind = "billing" | "donation" | "event";

function sessionPaymentId(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.payment_id || session.metadata?.billing_payment_id || null;
}

function sessionKind(session: Stripe.Checkout.Session): PaymentKind | null {
  const value = session.metadata?.payment_kind;
  if (value === "billing" || value === "donation" || value === "event") return value;
  return session.metadata?.billing_payment_id ? "billing" : null;
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function subscriptionId(session: Stripe.Checkout.Session): string | null {
  if (typeof session.subscription === "string") return session.subscription;
  return session.subscription?.id ?? null;
}

export async function finalizeCheckoutSession(session: Stripe.Checkout.Session): Promise<{ kind: PaymentKind | null; applied: boolean }> {
  const paymentId = sessionPaymentId(session);
  const kind = sessionKind(session);
  if (!paymentId || !kind || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    return { kind, applied: false };
  }

  if (kind === "billing") {
    const applied = await transaction((client) => applyBillingPayment(client, paymentId, paymentIntentId(session)));
    if (applied) {
      const receipt = await query<{
        amount: string; email: string | null; member_name: string; paid_at: Date | null;
        concepts: string[]; remaining_balance: string;
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
                   WHERE charge.account_id = payment.billing_account_id AND charge.status = 'open'
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
        }).catch((error) => console.error("[payments] billing receipt failed:", error));
      }
    }
    return { kind, applied };
  }

  if (kind === "event") {
    const result = await transaction(async (client) => {
      const payment = await client.query<{ status: string }>("SELECT status FROM payments WHERE id = $1 FOR UPDATE", [paymentId]);
      if (!payment.rows[0] || payment.rows[0].status !== "pending") return null;
      await client.query(
        `UPDATE payments
            SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), stripe_payment_intent = COALESCE($2, stripe_payment_intent), updated_at = NOW()
          WHERE id = $1`,
        [paymentId, paymentIntentId(session)],
      );
      await client.query(
        `UPDATE event_reservations SET status = 'confirmed', expires_at = NULL WHERE payment_id = $1 AND status = 'pending'`,
        [paymentId],
      );
      const rows = await client.query<{
        email: string; member_name: string; event_id: string; event_title: string; event_date: Date;
        location: string | null; row_label: string | null; seat_number: number | null; x: number | null;
        unit_price: string; seating_mode: string;
      }>(
        `SELECT reservation.holder_email AS email, reservation.holder_name AS member_name,
                event.id AS event_id, event.title AS event_title, event.event_date, event.location, event.seating_mode,
                seat.row_label, seat.seat_number, seat.x, reservation.unit_price::text
           FROM event_reservations reservation
           JOIN events event ON event.id = reservation.event_id
      LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
          WHERE reservation.payment_id = $1
          ORDER BY seat.row_label, seat.seat_number`,
        [paymentId],
      );
      if (!rows.rowCount) return null;
      const first = rows.rows[0];
      return {
        email: first.email,
        memberName: first.member_name,
        eventId: first.event_id,
        eventTitle: first.event_title,
        eventDate: first.event_date,
        location: first.location || "Midrash Natán Torá",
        seats: rows.rows.map((row) => row.row_label ? (row.x !== null ? row.row_label : `${row.row_label}${row.seat_number ?? ""}`) : row.seating_mode === "general" ? "Entrada general" : "Lugar libre"),
        attendeeNames: first.seating_mode === "general" ? rows.rows.map((row) => row.member_name) : undefined,
        quantity: rows.rows.length,
        total: rows.rows.reduce((sum, row) => sum + Number(row.unit_price), 0),
      };
    });
    if (result?.email) {
      await sendReservationConfirmation(result).catch((error) => console.error("[payments] reservation receipt failed:", error));
    }
    return { kind, applied: Boolean(result) };
  }

  const updated = await query<{
    donor_email: string | null; donor_name: string | null; amount: string; description: string | null;
    metadata: Record<string, unknown>; paid_at: Date | null;
  }>(
    `UPDATE payments
        SET status = 'paid', paid_at = COALESCE(paid_at, NOW()),
            stripe_payment_intent = COALESCE($2, stripe_payment_intent),
            stripe_subscription_id = COALESCE($3, stripe_subscription_id), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING donor_email, donor_name, amount::text, description, metadata, paid_at`,
    [paymentId, paymentIntentId(session), subscriptionId(session)],
  );
  const donation = updated.rows[0];
  if (donation?.donor_email) {
    await sendDonationReceipt({
      email: donation.donor_email,
      donorName: donation.donor_name || "Donante",
      amount: Number(donation.amount),
      purpose: donation.description || "Apoyo general al Midrash",
      recurring: donation.metadata?.frequency === "monthly",
      paidAt: donation.paid_at ?? new Date(),
    }).catch((error) => console.error("[payments] donation receipt failed:", error));
  }
  return { kind, applied: Boolean(donation) };
}

export async function failCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const paymentId = sessionPaymentId(session);
  if (!paymentId) return;
  await failPendingPayment(paymentId);
}

export async function failPendingPayment(paymentId: string): Promise<void> {
  const failed = await transaction(async (client) => {
    const payment = await client.query<{
      status: string; donor_email: string | null; donor_name: string | null; amount: string;
      description: string | null; metadata: Record<string, unknown>;
    }>(
      `SELECT status, donor_email, donor_name, amount::text, description, metadata
         FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    if (!payment.rows[0] || payment.rows[0].status !== "pending") return;
    const seats = await client.query<{ seat_id: string | null; seat_label: string | null }>(
      `SELECT reservation.seat_id,
              CASE WHEN seat.row_label IS NULL THEN NULL
                   WHEN seat.x IS NOT NULL THEN seat.row_label
                   ELSE seat.row_label || COALESCE(seat.seat_number::text, '') END AS seat_label
         FROM event_reservations reservation
    LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
        WHERE reservation.payment_id = $1 AND reservation.status = 'pending'
        FOR UPDATE OF reservation`,
      [paymentId],
    );
    const seatIds = seats.rows.map((row) => row.seat_id).filter((id): id is string => Boolean(id));
    if (seatIds.length) await client.query("UPDATE event_seats SET status = 'available' WHERE id = ANY($1::uuid[])", [seatIds]);
    await client.query("UPDATE event_reservations SET status = 'expired' WHERE payment_id = $1 AND status = 'pending'", [paymentId]);
    await client.query("UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1", [paymentId]);
    await recordFinancialAudit(client, { action: "payment.failed", entityType: "payment", entityId: paymentId, metadata: { reason: "expired_or_cancelled" } });
    const concepts = await client.query<{ concept: string }>(
      `SELECT charge.concept
         FROM billing_payment_allocations allocation
         JOIN billing_charges charge ON charge.id = allocation.charge_id
        WHERE allocation.payment_id = $1
        ORDER BY charge.created_at`,
      [paymentId],
    );
    const row = payment.rows[0];
    const kind = row.metadata?.kind;
    const eventId = typeof row.metadata?.event_id === "string" ? row.metadata.event_id : null;
    return {
      email: row.donor_email,
      memberName: row.donor_name || "Miembro",
      amount: Number(row.amount),
      description: row.description || "Pago en Natán Torá",
      details: seats.rows.map((seat) => seat.seat_label).filter((label): label is string => Boolean(label)).length
        ? seats.rows.map((seat) => seat.seat_label).filter((label): label is string => Boolean(label))
        : concepts.rows.map((concept) => concept.concept),
      retryPath: kind === "event" && eventId ? `/eventos/${eventId}` : kind === "donation" ? "/donativos" : "/mi-cuenta",
    };
  });
  if (failed?.email) {
    const delivery = await sendPaymentFailure({ ...failed, email: failed.email });
    if (!delivery.ok) await reportEmailFailure("Aviso de pago no completado", delivery.error, paymentId);
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  return parent?.id ?? null;
}

export async function recordRecurringDonation(invoice: Stripe.Invoice): Promise<boolean> {
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) return false;
  const subscription = invoiceSubscriptionId(invoice);
  if (!subscription) return false;
  let template = await query<{
    id: string; user_id: string | null; donor_name: string | null; donor_email: string | null;
    description: string | null; currency: string; metadata: Record<string, unknown>;
  }>("SELECT id, user_id, donor_name, donor_email, description, currency, metadata FROM payments WHERE stripe_subscription_id = $1 ORDER BY created_at LIMIT 1", [subscription]);
  if (!template.rows[0]) {
    const remote = await stripeClient().subscriptions.retrieve(subscription);
    const originalId = remote.metadata?.payment_id;
    if (originalId) {
      await query("UPDATE payments SET stripe_subscription_id = $2, updated_at = NOW() WHERE id = $1", [originalId, subscription]);
      template = await query("SELECT id, user_id, donor_name, donor_email, description, currency, metadata FROM payments WHERE id = $1", [originalId]);
    }
  }
  const source = template.rows[0];
  if (!source) return false;
  const amount = invoice.amount_paid / 100;
  const initialInvoice = invoice.billing_reason === "subscription_create";
  const row = initialInvoice
    ? await query<{ donor_email: string | null; donor_name: string | null; description: string | null }>(
      `UPDATE payments SET status = 'paid', amount = $2, stripe_invoice_id = $3,
              paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
        WHERE id = $1 AND stripe_invoice_id IS NULL
        RETURNING donor_email, donor_name, description`,
      [source.id, amount, invoice.id],
    )
    : await query<{ donor_email: string | null; donor_name: string | null; description: string | null }>(
      `INSERT INTO payments
        (user_id, amount, currency, status, payment_method, donor_name, donor_email, description,
         metadata, stripe_subscription_id, stripe_invoice_id, paid_at)
       VALUES ($1, $2, $3, 'paid', 'stripe', $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL DO NOTHING
       RETURNING donor_email, donor_name, description`,
      [source.user_id, amount, source.currency, source.donor_name, source.donor_email, source.description, source.metadata, subscription, invoice.id],
    );
  const donation = row.rows[0];
  if (donation?.donor_email) {
    await sendDonationReceipt({
      email: donation.donor_email,
      donorName: donation.donor_name || "Donante",
      amount,
      purpose: donation.description || "Apoyo general al Midrash",
      recurring: true,
    }).catch((error) => console.error("[payments] recurring donation receipt failed:", error));
  }
  return Boolean(donation);
}
