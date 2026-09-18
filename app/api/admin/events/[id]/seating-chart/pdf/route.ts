import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManageSeats, type Role } from "@/lib/permissions";
import { createSeatingChartPdf, type SeatingChartPdfSeat } from "@/lib/seating-chart-pdf";

export const dynamic = "force-dynamic";

type EventRow = { title: string; seating_mode: string };
type SeatRow = { id: string; x: number; y: number; rotation: number; holder_name: string };

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.status !== "approved" || !canManageSeats(admin.role as Role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const eventResult = await query<EventRow>(
    "SELECT title, seating_mode FROM events WHERE id = $1 LIMIT 1",
    [id],
  );
  const event = eventResult.rows[0];
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (event.seating_mode !== "assigned") {
    return NextResponse.json({ error: "Este evento no utiliza un plano de asientos" }, { status: 400 });
  }

  const seats = await query<SeatRow>(
    `SELECT seat.id, seat.x, seat.y, seat.rotation, reservation.holder_name
       FROM event_seats seat
       JOIN LATERAL (
            SELECT holder_name
              FROM event_reservations
             WHERE event_id = seat.event_id AND seat_id = seat.id AND status = 'confirmed'
             ORDER BY created_at DESC
             LIMIT 1
       ) reservation ON TRUE
      WHERE seat.event_id = $1 AND seat.retired = FALSE
        AND seat.x IS NOT NULL AND seat.y IS NOT NULL
        AND NULLIF(TRIM(reservation.holder_name), '') IS NOT NULL
      ORDER BY seat.row_label, seat.seat_number`,
    [id],
  );

  const planPng = await readFile(path.join(process.cwd(), "public", "venue-plan-reference.png"));
  const bytes = await createSeatingChartPdf({
    eventTitle: event.title,
    planPng,
    seats: seats.rows.map((seat): SeatingChartPdfSeat => ({
      id: seat.id,
      x: Number(seat.x),
      y: Number(seat.y),
      rotation: Number(seat.rotation),
      holderName: seat.holder_name,
    })),
  });

  const safeName = event.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase() || "evento";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="plano-${safeName}-con-nombres.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
