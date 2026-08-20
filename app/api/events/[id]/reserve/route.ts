import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";

type EventRecord = { id: string; seating_mode: "none" | "open" | "assigned"; capacity: number | null };

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

      let seat: { id: string; row_label: string; seat_number: number } | null = null;
      if (event.seating_mode === "open") {
        const countResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM event_reservations WHERE event_id = $1", [eventId]);
        if (Number(countResult.rows[0]?.count ?? 0) >= (event.capacity ?? 0)) throw new Error("SOLD_OUT");
      } else {
        if (typeof body.seatId !== "string" || !body.seatId) throw new Error("SEAT_REQUIRED");
        const seatResult = await client.query<{ id: string; row_label: string; seat_number: number; status: string }>("SELECT id, row_label, seat_number, status FROM event_seats WHERE id = $1 AND event_id = $2 FOR UPDATE", [body.seatId, eventId]);
        const selected = seatResult.rows[0];
        if (!selected || selected.status !== "available") throw new Error("SEAT_UNAVAILABLE");
        seat = selected;
      }

      const reservation = await client.query(
        `INSERT INTO event_reservations (event_id, user_id, seat_id, holder_name, holder_email, holder_phone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, event_id, seat_id, created_at`,
        [eventId, user.id, seat?.id ?? null, user.full_name || user.email, user.email, user.phone],
      );
      if (seat) await client.query("UPDATE event_seats SET status = 'occupied' WHERE id = $1", [seat.id]);
      return { reservation: reservation.rows[0], seat };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const responses: Record<string, [string, number]> = {
      EVENT_NOT_FOUND: ["Evento no encontrado", 404], NO_RESERVATIONS: ["Este evento no requiere reservación", 400],
      ALREADY_RESERVED: ["Ya tienes un lugar reservado en este evento", 409], SOLD_OUT: ["Ya no hay lugares disponibles", 409],
      SEAT_REQUIRED: ["Selecciona un asiento", 400], SEAT_UNAVAILABLE: ["Ese asiento acaba de ser ocupado. Elige otro.", 409],
    };
    const [text, status] = responses[message] ?? ["No fue posible completar la reservación", 500];
    return NextResponse.json({ error: text }, { status });
  }
}
