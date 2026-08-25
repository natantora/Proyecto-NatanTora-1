import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

type EventRecord = { id: string; seating_mode: "none" | "open" | "assigned"; capacity: number | null };

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (isRateLimited(`reserve:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en unos minutos." }, { status: 429 });
  }
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") return NextResponse.json({ error: "Necesitas una cuenta aprobada" }, { status: 401 });
  const { id: eventId } = await context.params;
  const body = await req.json().catch(() => ({}));

  try {
    const result = await transaction(async (client) => {
      const eventResult = await client.query<EventRecord>("SELECT id, seating_mode, capacity FROM events WHERE id = $1 FOR UPDATE", [eventId]);
      const event = eventResult.rows[0];
      if (!event) throw new Error("EVENT_NOT_FOUND");
      if (event.seating_mode === "none") throw new Error("NO_RESERVATIONS");
      const existing = await client.query("SELECT id FROM event_reservations WHERE event_id = $1 AND user_id = $2 LIMIT 1", [eventId, user.id]);
      if (existing.rowCount) throw new Error("ALREADY_RESERVED");

      let seats: { id: string; row_label: string; seat_number: number; x: number | null }[] = [];
      if (event.seating_mode === "open") {
        const countResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM event_reservations WHERE event_id = $1", [eventId]);
        if (Number(countResult.rows[0]?.count ?? 0) >= (event.capacity ?? 0)) throw new Error("SOLD_OUT");
      } else {
        const requestedIds: unknown[] = Array.isArray(body.seatIds) ? body.seatIds : typeof body.seatId === "string" ? [body.seatId] : [];
        const seatIds = [...new Set(requestedIds.filter((seatId): seatId is string => typeof seatId === "string" && seatId.length > 0))];
        if (seatIds.length === 0) throw new Error("SEAT_REQUIRED");
        const seatResult = await client.query<{ id: string; row_label: string; seat_number: number; status: string; x: number | null }>(
          "SELECT id, row_label, seat_number, status, x FROM event_seats WHERE id = ANY($1::uuid[]) AND event_id = $2 ORDER BY id FOR UPDATE",
          [seatIds, eventId],
        );
        if (seatResult.rows.length !== seatIds.length || seatResult.rows.some((seat) => seat.status !== "available")) throw new Error("SEAT_UNAVAILABLE");
        const seatById = new Map(seatResult.rows.map((seat) => [seat.id, seat]));
        seats = seatIds.map((seatId) => seatById.get(seatId)).filter((seat): seat is NonNullable<typeof seat> => Boolean(seat));
      }

      const reservation = seats.length
        ? await client.query<{ id: string; event_id: string; seat_id: string | null; created_at: Date }>(
          `INSERT INTO event_reservations (event_id, user_id, seat_id, holder_name, holder_email, holder_phone)
           SELECT $1, $2, selected_seat_id, $4, $5, $6
             FROM unnest($3::uuid[]) AS selected_seat_id
           RETURNING id, event_id, seat_id, created_at`,
          [eventId, user.id, seats.map((seat) => seat.id), user.full_name || user.email, user.email, user.phone],
        )
        : await client.query<{ id: string; event_id: string; seat_id: string | null; created_at: Date }>(
          `INSERT INTO event_reservations (event_id, user_id, seat_id, holder_name, holder_email, holder_phone)
           VALUES ($1, $2, NULL, $3, $4, $5)
           RETURNING id, event_id, seat_id, created_at`,
          [eventId, user.id, user.full_name || user.email, user.email, user.phone],
        );
      if (seats.length) await client.query("UPDATE event_seats SET status = 'occupied' WHERE id = ANY($1::uuid[])", [seats.map((seat) => seat.id)]);
      const reservationBySeat = new Map(reservation.rows.map((item) => [item.seat_id, item]));
      const reservations = seats.length ? seats.map((seat) => reservationBySeat.get(seat.id)).filter(Boolean) : reservation.rows;
      return { reservation: reservations[0], reservations, seat: seats[0] ?? null, seats };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const responses: Record<string, [string, number]> = {
      EVENT_NOT_FOUND: ["Evento no encontrado", 404], NO_RESERVATIONS: ["Este evento no requiere reservación", 400],
      ALREADY_RESERVED: ["Ya tienes una reservación en este evento", 409], SOLD_OUT: ["Ya no hay lugares disponibles", 409],
      SEAT_REQUIRED: ["Selecciona al menos un asiento", 400], SEAT_UNAVAILABLE: ["Uno de esos asientos acaba de ser ocupado. Revisa tu selección.", 409],
    };
    const [text, status] = responses[message] ?? ["No fue posible completar la reservación", 500];
    return NextResponse.json({ error: text }, { status });
  }
}
