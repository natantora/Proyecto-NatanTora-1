import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { canManageSeats, type Role } from "@/lib/permissions";

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000
    ? Math.round(parsed * 100) / 100
    : null;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.status !== "approved" || !canManageSeats(admin.role as Role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: eventId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const seatIds = [...new Set(
    Array.isArray(body.seat_ids)
      ? body.seat_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [],
  )].slice(0, 500);
  const useDefault = body.use_default === true;
  const price = useDefault ? null : money(body.price);

  if (!seatIds.length) return NextResponse.json({ error: "Selecciona al menos un asiento" }, { status: 400 });
  if (!useDefault && price === null) return NextResponse.json({ error: "Escribe un precio válido" }, { status: 400 });

  try {
    const updated = await transaction(async (client) => {
      const event = await client.query<{ seating_mode: string }>(
        "SELECT seating_mode FROM events WHERE id = $1 FOR UPDATE",
        [eventId],
      );
      if (event.rows[0]?.seating_mode !== "assigned") throw new Error("INVALID_EVENT");

      const result = await client.query<{ id: string }>(
        `UPDATE event_seats
            SET price = $3
          WHERE event_id = $1
            AND id = ANY($2::uuid[])
            AND retired = FALSE
        RETURNING id`,
        [eventId, seatIds, price],
      );
      if (result.rows.length !== seatIds.length) throw new Error("INVALID_SEATS");
      return result.rows.length;
    });

    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/eventos/${eventId}`);
    revalidatePath("/eventos");
    return NextResponse.json({ ok: true, updated, price });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_EVENT") return NextResponse.json({ error: "El evento no usa selección de asientos" }, { status: 409 });
    if (message === "INVALID_SEATS") return NextResponse.json({ error: "Uno de los asientos ya no pertenece a este evento" }, { status: 409 });
    console.error("[admin/events/seat-prices] update failed:", error);
    return NextResponse.json({ error: "No fue posible guardar los precios" }, { status: 500 });
  }
}
