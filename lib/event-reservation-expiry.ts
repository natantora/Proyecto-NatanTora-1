import { query } from "@/lib/db";
import { failPendingPayment } from "@/lib/payment-processing";

export async function expireStaleEventReservations(eventId: string): Promise<void> {
  const stale = await query<{ payment_id: string }>(
      `SELECT DISTINCT reservation.payment_id
         FROM event_reservations reservation
    LEFT JOIN payments payment ON payment.id = reservation.payment_id
        WHERE reservation.event_id = $1
          AND reservation.status = 'pending'
          AND reservation.payment_id IS NOT NULL
          AND COALESCE(reservation.expires_at, payment.expires_at) <= NOW()
        `,
      [eventId],
    );
  await Promise.all(stale.rows.map((row) => failPendingPayment(row.payment_id)));
}
