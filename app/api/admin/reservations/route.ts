import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { canManageSeats, type Role } from "@/lib/permissions";
import { sendReservationCancellation } from "@/lib/transactional-emails";

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
          ORDER BY reservation.created_at, seat.row_label, seat.seat_number
          FOR UPDATE OF reservation`,
        [eventId, userId],
      );
      if (!rows.rowCount) throw new Error("RESERVATION_NOT_FOUND");
      const seatIds = rows.rows.map((row) => row.seat_id).filter((id): id is string => Boolean(id));
      if (seatIds.length) {
        await client.query("UPDATE event_seats SET status = 'available' WHERE id = ANY($1::uuid[])", [seatIds]);
      }
      await client.query("DELETE FROM event_reservations WHERE event_id = $1 AND user_id = $2", [eventId, userId]);
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
    if (error instanceof Error && error.message === "RESERVATION_NOT_FOUND") {
      return NextResponse.json({ error: "La reservación ya no existe" }, { status: 404 });
    }
    console.error("[admin/reservations] cancellation failed:", error);
    return NextResponse.json({ error: "No se pudo cancelar la reservación" }, { status: 500 });
  }
}
