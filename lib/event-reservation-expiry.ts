import { transaction } from "@/lib/db";

export async function expireStaleEventReservations(eventId: string): Promise<void> {
  await transaction(async (client) => {
    const stale = await client.query<{ seat_id: string | null; payment_id: string | null }>(
      `SELECT reservation.seat_id, reservation.payment_id
         FROM event_reservations reservation
    LEFT JOIN payments payment ON payment.id = reservation.payment_id
        WHERE reservation.event_id = $1
          AND reservation.status = 'pending'
          AND COALESCE(reservation.expires_at, payment.expires_at) <= NOW()
        FOR UPDATE OF reservation`,
      [eventId],
    );
    if (!stale.rowCount) return;
    const seatIds = stale.rows.map((row) => row.seat_id).filter((id): id is string => Boolean(id));
    const paymentIds = [...new Set(stale.rows.map((row) => row.payment_id).filter((id): id is string => Boolean(id)))];
    if (seatIds.length) await client.query("UPDATE event_seats SET status = 'available' WHERE id = ANY($1::uuid[])", [seatIds]);
    await client.query(
      `UPDATE event_reservations SET status = 'expired'
        WHERE event_id = $1 AND status = 'pending'
          AND expires_at <= NOW()`,
      [eventId],
    );
    if (paymentIds.length) await client.query("UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = ANY($1::uuid[]) AND status = 'pending'", [paymentIds]);
  });
}
