import { applyBillingPayment } from "@/lib/billing";
import { query, transaction } from "@/lib/db";
import { sendDonationReceipt, sendPaymentReceipt, sendReservationConfirmation } from "@/lib/transactional-emails";
import type { MercadoPagoPayment } from "@/lib/mercado-pago";
import { failPendingPayment } from "@/lib/payment-processing";
import { recordFinancialAudit } from "@/lib/financial-audit";
import { reportEmailFailure, reportSystemAlert } from "@/lib/system-alerts";

type PaymentKind = "billing" | "donation" | "event";

async function markMercadoPagoReversal(paymentId: string, status: "refunded" | "charged_back"): Promise<void> {
  await transaction(async (client) => {
    const payment = await client.query<{ status: string; metadata: Record<string, unknown> }>(
      "SELECT status, metadata FROM payments WHERE id = $1 FOR UPDATE",
      [paymentId],
    );
    if (!payment.rows[0] || payment.rows[0].status === status) return;
    if (payment.rows[0].status === "pending") {
      const seats = await client.query<{ seat_id: string | null }>(
        "SELECT seat_id FROM event_reservations WHERE payment_id = $1 AND status = 'pending' FOR UPDATE",
        [paymentId],
      );
      const seatIds = seats.rows.map((row) => row.seat_id).filter((id): id is string => Boolean(id));
      if (seatIds.length) await client.query("UPDATE event_seats SET status = 'available' WHERE id = ANY($1::uuid[])", [seatIds]);
      await client.query("UPDATE event_reservations SET status = 'expired' WHERE payment_id = $1 AND status = 'pending'", [paymentId]);
    } else if (payment.rows[0].status === "paid" && payment.rows[0].metadata?.kind === "billing") {
      const allocations = await client.query<{ charge_id: string; amount: string }>(
        "SELECT charge_id, amount::text FROM billing_payment_allocations WHERE payment_id = $1 ORDER BY charge_id",
        [paymentId],
      );
      for (const allocation of allocations.rows) {
        await client.query(
          `UPDATE billing_charges
              SET outstanding_amount = LEAST(original_amount, outstanding_amount + $2),
                  status = 'open', updated_at = NOW()
            WHERE id = $1`,
          [allocation.charge_id, Number(allocation.amount)],
        );
      }
    }
    await client.query("UPDATE payments SET status = $2, updated_at = NOW() WHERE id = $1", [paymentId, status]);
    await recordFinancialAudit(client, { action: status === "refunded" ? "payment.refunded" : "payment.charged_back", entityType: "payment", entityId: paymentId, metadata: { provider: "mercadopago" } });
  });
}

export async function reconcileMercadoPagoPayment(paymentId: string, remote: MercadoPagoPayment): Promise<void> {
  await query(
    `UPDATE payments
        SET payment_method = 'mercadopago',
            mercadopago_payment_id = COALESCE(mercadopago_payment_id, $2),
            provider_status = $3,
            provider_status_detail = $4,
            provider_updated_at = COALESCE($5::timestamptz, NOW()),
            updated_at = NOW()
      WHERE id = $1`,
    [paymentId, String(remote.id), remote.status, remote.status_detail || null, remote.date_last_updated || null],
  );
  if (remote.status === "approved") {
    await finalizeMercadoPagoPayment(paymentId, String(remote.id));
  } else if (["rejected", "cancelled"].includes(remote.status)) {
    await failPendingPayment(paymentId);
  } else if (remote.status === "refunded" || remote.status === "charged_back") {
    await markMercadoPagoReversal(paymentId, remote.status);
  }
}

export async function finalizeMercadoPagoPayment(paymentId: string, providerPaymentId: string): Promise<boolean> {
  const payment = await query<{ status: string; metadata: Record<string, unknown>; payment_method: string | null }>(
    "SELECT status, metadata, payment_method FROM payments WHERE id = $1 LIMIT 1",
    [paymentId],
  );
  if (payment.rows[0]?.status === "paid") return true;
  if (["refunded", "charged_back"].includes(payment.rows[0]?.status || "")) return false;
  const kind = payment.rows[0]?.metadata?.kind as PaymentKind | undefined;
  if (!kind || !["billing", "donation", "event"].includes(kind)) return false;
  await query(
    `UPDATE payments SET payment_method = 'mercadopago',
       mercadopago_payment_id = COALESCE(mercadopago_payment_id, $2),
       provider_status = 'approved', provider_updated_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [paymentId, providerPaymentId],
  );

  if (kind === "billing") {
    const applied = await transaction(async (client) => {
      const success = await applyBillingPayment(client, paymentId);
      if (success) await recordFinancialAudit(client, { action: "payment.approved", entityType: "payment", entityId: paymentId, metadata: { provider: "mercadopago", kind: "billing" } });
      return success;
    });
    if (!applied) {
      await reportSystemAlert({ severity: "critical", category: "payments", title: "Pago aprobado sin poder aplicarse", message: `Mercado Pago aprobó el pago ${paymentId}, pero el saldo no pudo actualizarse.`, fingerprint: `payment:apply:${paymentId}`, context: { payment_id: paymentId, provider_payment_id: providerPaymentId } });
      return false;
    }
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
    if (data?.email) { const delivery = await sendPaymentReceipt({ email: data.email, memberName: data.member_name, amount: Number(data.amount), method: "mercadopago", concepts: data.concepts || [], remainingBalance: Number(data.remaining_balance), paidAt: data.paid_at || new Date() }); if (!delivery.ok) await reportEmailFailure("Recibo de estado de cuenta", delivery.error, paymentId); }
    return true;
  }

  if (kind === "event") {
    const result = await transaction(async (client) => {
      const lockedPayment = await client.query<{ status: string; metadata: Record<string, unknown> }>(
        "SELECT status, metadata FROM payments WHERE id = $1 FOR UPDATE",
        [paymentId],
      );
      if (!lockedPayment.rows[0]) return { state: "missing" as const, eventId: null, seatIds: [] as string[] };
      if (lockedPayment.rows[0].status === "paid") return { state: "already-paid" as const };
      if (["refunded", "charged_back"].includes(lockedPayment.rows[0].status)) return { state: "reversed" as const };

      const eventId = typeof lockedPayment.rows[0].metadata?.event_id === "string" ? lockedPayment.rows[0].metadata.event_id : null;
      const event = eventId
        ? await client.query<{ id: string; seating_mode: string; capacity: number | null }>(
          "SELECT id, seating_mode, capacity FROM events WHERE id = $1 FOR UPDATE",
          [eventId],
        )
        : null;
      const rows = await client.query<{ id: string; seat_id: string | null; email: string; member_name: string; event_id: string; event_title: string; event_date: Date; location: string | null; row_label: string | null; seat_number: number | null; x: number | null; unit_price: string }>(
        `SELECT reservation.id, reservation.seat_id, reservation.holder_email AS email, reservation.holder_name AS member_name,
                event.id AS event_id, event.title AS event_title, event.event_date, event.location,
                seat.row_label, seat.seat_number, seat.x, reservation.unit_price::text
           FROM event_reservations reservation JOIN events event ON event.id = reservation.event_id
      LEFT JOIN event_seats seat ON seat.id = reservation.seat_id WHERE reservation.payment_id = $1
          ORDER BY seat.row_label, seat.seat_number FOR UPDATE OF reservation`, [paymentId]);
      const seatIds = rows.rows.map((row) => row.seat_id).filter((id): id is string => Boolean(id));
      let conflicts: string[] = [];
      if (event?.rows[0]?.seating_mode === "assigned" && seatIds.length) {
        const occupied = await client.query<{ seat_id: string }>(
          `SELECT DISTINCT seat_id
             FROM event_reservations
            WHERE event_id = $2 AND seat_id = ANY($3::uuid[]) AND payment_id IS DISTINCT FROM $1
              AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW()))`,
          [paymentId, eventId, seatIds],
        );
        conflicts = occupied.rows.map((row) => row.seat_id);
      } else if (event?.rows[0]?.seating_mode === "open" && rows.rowCount) {
        const active = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM event_reservations
            WHERE event_id = $1 AND payment_id IS DISTINCT FROM $2
              AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW()))`,
          [eventId, paymentId],
        );
        if (Number(active.rows[0]?.count || 0) + rows.rows.length > Number(event.rows[0].capacity || 0)) conflicts = ["CAPACITY"];
      }

      await client.query(
        "UPDATE payments SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'failed')",
        [paymentId],
      );
      if (!event?.rows[0] || !rows.rowCount || conflicts.length) {
        await recordFinancialAudit(client, {
          action: "payment.approved_with_reservation_conflict",
          entityType: "payment",
          entityId: paymentId,
          metadata: { provider: "mercadopago", kind: "event", event_id: eventId, seat_ids: seatIds, conflicts },
        });
        return { state: "conflict" as const, eventId, seatIds, conflicts };
      }

      await client.query("UPDATE event_reservations SET status = 'confirmed', expires_at = NULL WHERE payment_id = $1 AND status IN ('pending', 'expired', 'cancelled')", [paymentId]);
      if (seatIds.length) await client.query("UPDATE event_seats SET status = 'occupied' WHERE id = ANY($1::uuid[])", [seatIds]);
      await recordFinancialAudit(client, { action: "payment.approved", entityType: "payment", entityId: paymentId, metadata: { provider: "mercadopago", kind: "event" } });
      const first = rows.rows[0];
      return { state: "confirmed" as const, email: first.email, memberName: first.member_name, eventId: first.event_id, eventTitle: first.event_title, eventDate: first.event_date, location: first.location || "Midrash Natán Torá", seats: rows.rows.map((row) => row.row_label ? (row.x !== null ? row.row_label : `${row.row_label}${row.seat_number || ""}`) : event?.rows[0]?.seating_mode === "general" ? "Entrada general" : "Lugar libre"), quantity: rows.rows.length, total: rows.rows.reduce((sum, row) => sum + Number(row.unit_price), 0) };
    });
    if (result.state === "conflict" || result.state === "missing") {
      await reportSystemAlert({
        severity: "critical",
        category: "payments",
        title: "Pago aprobado requiere asignación manual",
        message: `Mercado Pago aprobó ${paymentId}, pero la reservación no pudo confirmarse automáticamente porque el lugar ya no está disponible o faltan datos. No se duplicó ningún asiento.`,
        fingerprint: `payment:reservation-conflict:${paymentId}`,
        context: { payment_id: paymentId, provider_payment_id: providerPaymentId, event_id: result.eventId, seat_ids: result.seatIds, conflicts: "conflicts" in result ? result.conflicts : [] },
      });
      return true;
    }
    if (result.state === "confirmed" && result.email) { const delivery = await sendReservationConfirmation(result); if (!delivery.ok) await reportEmailFailure("Confirmación de reservación", delivery.error, paymentId); }
    return result.state === "confirmed" || result.state === "already-paid";
  }

  const data = await transaction(async (client) => {
    const donation = await client.query<{ donor_email: string | null; donor_name: string | null; amount: string; description: string | null; paid_at: Date | null }>(
      `UPDATE payments SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
        WHERE id = $1 AND status IN ('pending', 'failed')
        RETURNING donor_email, donor_name, amount::text, description, paid_at`, [paymentId]);
    if (donation.rows[0]) await recordFinancialAudit(client, { action: "payment.approved", entityType: "payment", entityId: paymentId, metadata: { provider: "mercadopago", kind: "donation" } });
    return donation.rows[0];
  });
  if (data?.donor_email) { const delivery = await sendDonationReceipt({ email: data.donor_email, donorName: data.donor_name || "Donante", amount: Number(data.amount), purpose: data.description || "Apoyo general al Midrash", recurring: false, paidAt: data.paid_at || new Date() }); if (!delivery.ok) await reportEmailFailure("Recibo de donativo", delivery.error, paymentId); }
  return Boolean(data);
}
