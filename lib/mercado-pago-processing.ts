import { applyBillingPayment } from "@/lib/billing";
import { query, transaction } from "@/lib/db";
import { sendDonationReceipt, sendPaymentReceipt, sendReservationConfirmation } from "@/lib/transactional-emails";

type PaymentKind = "billing" | "donation" | "event";

export async function finalizeMercadoPagoPayment(paymentId: string, providerPaymentId: string): Promise<boolean> {
  const payment = await query<{ metadata: Record<string, unknown>; payment_method: string | null }>(
    "SELECT metadata, payment_method FROM payments WHERE id = $1 LIMIT 1",
    [paymentId],
  );
  const kind = payment.rows[0]?.metadata?.kind as PaymentKind | undefined;
  if (!kind || !["billing", "donation", "event"].includes(kind)) return false;
  await query(
    `UPDATE payments SET payment_method = 'mercadopago',
       mercadopago_payment_id = COALESCE(mercadopago_payment_id, $2), updated_at = NOW()
     WHERE id = $1`,
    [paymentId, providerPaymentId],
  );

  if (kind === "billing") {
    const applied = await transaction((client) => applyBillingPayment(client, paymentId));
    if (!applied) return false;
    const receipt = await query<{ amount: string; email: string | null; member_name: string; concepts: string[]; remaining_balance: string; paid_at: Date | null }>(
      `SELECT payment.amount::text, COALESCE(payment.donor_email, account.email) AS email,
              COALESCE(payment.donor_name, account.display_name, 'Miembro') AS member_name,
              payment.paid_at, ARRAY(SELECT charge.concept FROM billing_payment_allocations allocation
                JOIN billing_charges charge ON charge.id = allocation.charge_id
                WHERE allocation.payment_id = payment.id ORDER BY charge.created_at) AS concepts,
              COALESCE((SELECT SUM(outstanding_amount) FROM billing_charges
                WHERE account_id = payment.billing_account_id AND status = 'open'), 0)::text AS remaining_balance
         FROM payments payment LEFT JOIN billing_accounts account ON account.id = payment.billing_account_id
        WHERE payment.id = $1`,
      [paymentId],
    );
    const data = receipt.rows[0];
    if (data?.email) await sendPaymentReceipt({ email: data.email, memberName: data.member_name, amount: Number(data.amount), method: "mercadopago", concepts: data.concepts || [], remainingBalance: Number(data.remaining_balance), paidAt: data.paid_at || new Date() }).catch((error) => console.error("[mercadopago] billing receipt failed", error));
    return true;
  }

  if (kind === "event") {
    const result = await transaction(async (client) => {
      const updated = await client.query("UPDATE payments SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id", [paymentId]);
      if (!updated.rowCount) return null;
      await client.query("UPDATE event_reservations SET status = 'confirmed', expires_at = NULL WHERE payment_id = $1 AND status = 'pending'", [paymentId]);
      const rows = await client.query<{ email: string; member_name: string; event_id: string; event_title: string; event_date: Date; location: string | null; row_label: string | null; seat_number: number | null; x: number | null; unit_price: string }>(
        `SELECT reservation.holder_email AS email, reservation.holder_name AS member_name,
                event.id AS event_id, event.title AS event_title, event.event_date, event.location,
                seat.row_label, seat.seat_number, seat.x, reservation.unit_price::text
           FROM event_reservations reservation JOIN events event ON event.id = reservation.event_id
      LEFT JOIN event_seats seat ON seat.id = reservation.seat_id WHERE reservation.payment_id = $1
          ORDER BY seat.row_label, seat.seat_number`, [paymentId]);
      if (!rows.rowCount) return null;
      const first = rows.rows[0];
      return { email: first.email, memberName: first.member_name, eventId: first.event_id, eventTitle: first.event_title, eventDate: first.event_date, location: first.location || "Midrash Natán Torá", seats: rows.rows.map((row) => row.row_label ? (row.x !== null ? row.row_label : `${row.row_label}${row.seat_number || ""}`) : "Lugar libre"), quantity: rows.rows.length, total: rows.rows.reduce((sum, row) => sum + Number(row.unit_price), 0) };
    });
    if (result) await sendReservationConfirmation(result).catch((error) => console.error("[mercadopago] reservation receipt failed", error));
    return Boolean(result);
  }

  const donation = await query<{ donor_email: string | null; donor_name: string | null; amount: string; description: string | null; paid_at: Date | null }>(
    `UPDATE payments SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING donor_email, donor_name, amount::text, description, paid_at`, [paymentId]);
  const data = donation.rows[0];
  if (data?.donor_email) await sendDonationReceipt({ email: data.donor_email, donorName: data.donor_name || "Donante", amount: Number(data.amount), purpose: data.description || "Apoyo general al Midrash", recurring: false, paidAt: data.paid_at || new Date() }).catch((error) => console.error("[mercadopago] donation receipt failed", error));
  return Boolean(data);
}
