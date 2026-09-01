import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { canManageSeats, type Role } from "@/lib/permissions";
import { stripeClient } from "@/lib/stripe";
import { sendReservationCancellation } from "@/lib/transactional-emails";

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.status !== "approved" || !canManageSeats(admin.role as Role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  const seatIds = [...new Set(Array.isArray(body.seat_ids) ? body.seat_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0) : [])].slice(0, 50);
  const holderName = typeof body.holder_name === "string" && body.holder_name.trim()
    ? body.holder_name.trim().slice(0, 120)
    : "Cortesía del Midrash";
  if (!eventId || !seatIds.length) return NextResponse.json({ error: "Selecciona al menos un asiento" }, { status: 400 });

  try {
    const reservations = await transaction(async (client) => {
      const event = await client.query<{ id: string; seating_mode: string }>(
        "SELECT id, seating_mode FROM events WHERE id = $1 FOR UPDATE",
        [eventId],
      );
      if (!event.rows[0] || event.rows[0].seating_mode !== "assigned") throw new Error("INVALID_EVENT");
      const seats = await client.query<{ id: string; status: string }>(
        "SELECT id, status FROM event_seats WHERE event_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE",
        [eventId, seatIds],
      );
      if (seats.rows.length !== seatIds.length || seats.rows.some((seat) => seat.status !== "available")) {
        throw new Error("SEAT_UNAVAILABLE");
      }
      const inserted = await client.query(
        `INSERT INTO event_reservations
          (event_id, user_id, seat_id, holder_name, holder_email, holder_phone, unit_price, status, expires_at, payment_id)
         SELECT $1, $2, selected_seat_id, $4, $5, $6, 0, 'confirmed', NULL, NULL
           FROM unnest($3::uuid[]) AS selected_seat_id
         RETURNING id, seat_id`,
        [eventId, admin.id, seatIds, holderName, admin.email, admin.phone],
      );
      await client.query("UPDATE event_seats SET status = 'occupied' WHERE id = ANY($1::uuid[])", [seatIds]);
      return inserted.rows;
    });
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath("/admin/reservations");
    revalidatePath(`/eventos/${eventId}`);
    return NextResponse.json({ ok: true, reservations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_EVENT") return NextResponse.json({ error: "El evento no usa selección de asientos" }, { status: 409 });
    if (message === "SEAT_UNAVAILABLE") return NextResponse.json({ error: "Uno de los asientos ya fue ocupado. Actualiza el plano e inténtalo de nuevo." }, { status: 409 });
    console.error("[admin/reservations] complimentary reservation failed:", error);
    return NextResponse.json({ error: "No se pudieron reservar las cortesías" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.status !== "approved" || !canManageSeats(admin.role as Role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!eventId || !userId) return NextResponse.json({ error: "Reservación inválida" }, { status: 400 });

  try {
    const payment = await query<{ id: string; status: string; stripe_session_id: string | null }>(
      `SELECT payment.id, payment.status, payment.stripe_session_id
         FROM event_reservations reservation
         JOIN payments payment ON payment.id = reservation.payment_id
        WHERE reservation.event_id = $1 AND reservation.user_id = $2
          AND reservation.status IN ('pending', 'confirmed')
        LIMIT 1`,
      [eventId, userId],
    );
    if (payment.rows[0]?.status === "paid") throw new Error("PAID_RESERVATION_LOCKED");
    if (payment.rows[0]?.status === "pending" && payment.rows[0].stripe_session_id) {
      await stripeClient().checkout.sessions.expire(payment.rows[0].stripe_session_id);
    }
    const cancelled = await transaction(async (client) => {
      const rows = await client.query<{
        id: string;
        seat_id: string | null;
        holder_name: string;
        holder_email: string;
        unit_price: string;
        row_label: string | null;
        seat_number: number | null;
        x: number | null;
        event_title: string;
        event_date: Date;
        location: string | null;
      }>(
        `SELECT reservation.id, reservation.seat_id, reservation.holder_name,
                reservation.holder_email, reservation.unit_price::text,
                seat.row_label, seat.seat_number, seat.x,
                event.title AS event_title, event.event_date, event.location
           FROM event_reservations reservation
           JOIN events event ON event.id = reservation.event_id
      LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
          WHERE reservation.event_id = $1 AND reservation.user_id = $2
            AND reservation.status IN ('pending', 'confirmed')
          ORDER BY reservation.created_at, seat.row_label, seat.seat_number
          FOR UPDATE OF reservation`,
        [eventId, userId],
      );
      if (!rows.rowCount) throw new Error("RESERVATION_NOT_FOUND");
      const seatIds = rows.rows.map((row) => row.seat_id).filter((id): id is string => Boolean(id));
      if (seatIds.length) {
        await client.query("UPDATE event_seats SET status = 'available' WHERE id = ANY($1::uuid[])", [seatIds]);
      }
      await client.query("UPDATE event_reservations SET status = 'cancelled', expires_at = NULL WHERE event_id = $1 AND user_id = $2 AND status IN ('pending', 'confirmed')", [eventId, userId]);
      if (payment.rows[0]?.status === "pending") {
        await client.query("UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1 AND status = 'pending'", [payment.rows[0].id]);
      }
      const first = rows.rows[0];
      return {
        email: first.holder_email,
        memberName: first.holder_name,
        eventId,
        eventTitle: first.event_title,
        eventDate: first.event_date,
        location: first.location || "Midrash Natán Torá",
        seats: rows.rows.map((row) => row.seat_id ? (row.x !== null ? row.row_label || "Asiento" : `${row.row_label || ""}${row.seat_number || ""}`) : "Lugar libre"),
        quantity: rows.rows.length,
        total: rows.rows.reduce((sum, row) => sum + Number(row.unit_price ?? 0), 0),
      };
    });
    await sendReservationCancellation(cancelled).catch((emailError) => console.error("[admin/reservations] cancellation email failed:", emailError));
    revalidatePath("/admin/reservations");
    revalidatePath(`/eventos/${eventId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PAID_RESERVATION_LOCKED") {
      return NextResponse.json({ error: "Una silla pagada es definitiva y no se puede cancelar." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "RESERVATION_NOT_FOUND") {
      return NextResponse.json({ error: "La reservación ya no existe" }, { status: 404 });
    }
    console.error("[admin/reservations] cancellation failed:", error);
    return NextResponse.json({ error: "No se pudo cancelar la reservación" }, { status: 500 });
  }
}
