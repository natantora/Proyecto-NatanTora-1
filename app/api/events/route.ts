import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction, query } from "@/lib/db";
import { canEditEvents, type Role } from "@/lib/permissions";
import { getVenueLayout } from "@/lib/venue-layout";
import { ARCHITECTURAL_SEATS } from "@/lib/architectural-seat-map";
import { renumberSeatsByVisualOrder } from "@/lib/seat-numbering";

type SeatingMode = "none" | "open" | "assigned";
type SeatPlanType = "architectural" | "custom";

async function isAuthorized() {
  const user = await getCurrentUser();
  return !!user && user.status === "approved" && canEditEvents(user.role as Role);
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000 ? Math.round(parsed * 100) / 100 : null;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const eventDate = new Date(body.event_date);
  const seatingMode: SeatingMode = ["none", "open", "assigned"].includes(body.seating_mode)
    ? body.seating_mode
    : "none";
  const seatPlanType: SeatPlanType = body.seat_plan_type === "custom" ? "custom" : "architectural";
  const seatPrice = seatingMode !== "none" ? money(body.seat_price) : 0;

  if (!title || Number.isNaN(eventDate.getTime())) {
    return NextResponse.json({ error: "Título y fecha son obligatorios" }, { status: 400 });
  }
  if (seatingMode !== "none" && seatPrice === null) {
    return NextResponse.json({ error: "El precio por asiento debe ser un importe válido" }, { status: 400 });
  }

  let capacity: number | null = null;
  let venueLayout: Awaited<ReturnType<typeof getVenueLayout>> = { tables: [], seats: [] };
  let eventSeats: Array<{ x: number; y: number; rotation: number; label: string | null; seatNumber?: number }> = [];

  if (seatingMode === "open") {
    capacity = integer(body.capacity);
    if (!capacity || capacity < 1 || capacity > 1000) {
      return NextResponse.json({ error: "El cupo debe ser de 1 a 1,000 personas" }, { status: 400 });
    }
  }

  if (seatingMode === "assigned") {
    if (seatPlanType === "architectural") {
      eventSeats = ARCHITECTURAL_SEATS;
    } else {
      venueLayout = await getVenueLayout();
      eventSeats = renumberSeatsByVisualOrder(venueLayout.seats).map((seat, index) => ({
        ...seat,
        seatNumber: index + 1,
      }));
    }
    if (eventSeats.length === 0) {
      return NextResponse.json(
        { error: "Primero configura el plano personalizado en Admin > Mapa de asientos" },
        { status: 400 },
      );
    }
    capacity = eventSeats.length;
  }

  try {
    const event = await transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO events
          (title, description, event_date, location, image_url, seating_mode, seat_plan_type, capacity, seat_price, published, reservations_open)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, FALSE)
         RETURNING *`,
        [
          title,
          typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
          eventDate,
          typeof body.location === "string" && body.location.trim() ? body.location.trim() : "Midrash Natán Torá",
          typeof body.image_url === "string" && body.image_url.trim() ? body.image_url.trim() : null,
          seatingMode,
          seatPlanType,
          capacity,
          seatPrice ?? 0,
        ],
      );
      const created = inserted.rows[0];

      if (seatingMode === "assigned") {
        if (seatPlanType === "custom" && venueLayout.tables.length) {
          const tableValues: unknown[] = [];
          const tableGroups = venueLayout.tables.map((table) => {
            tableValues.push(created.id, table.kind, table.x, table.y, table.width, table.height, table.rotation, table.label);
            const offset = tableValues.length - 7;
            return `($${offset}, $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
          });
          await client.query(
            `INSERT INTO event_venue_tables (event_id, kind, x, y, width, height, rotation, label) VALUES ${tableGroups.join(", ")}`,
            tableValues,
          );
        }

        const values: unknown[] = [];
        const groups: string[] = [];
        eventSeats.forEach((seat, index) => {
          values.push(created.id, seat.label ?? String(index + 1), seat.seatNumber ?? index + 1, seat.x, seat.y, seat.rotation);
          const offset = values.length - 5;
          groups.push(`($${offset}, $${offset + 1}, $${offset + 2}, 'available', $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        });
        await client.query(
          `INSERT INTO event_seats (event_id, row_label, seat_number, status, x, y, rotation) VALUES ${groups.join(", ")}`,
          values,
        );
      }

      return created;
    });

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    console.error("Error creating event", error);
    return NextResponse.json({ error: "No fue posible crear el evento" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  if (body.action === "publish") {
    const result = await query(
      "UPDATE events SET published = TRUE, published_at = COALESCE(published_at, NOW()) WHERE id = $1 RETURNING *",
      [body.id],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, event: result.rows[0] });
  }

  if (body.action === "open_reservations") {
    const result = await query(
      "UPDATE events SET reservations_open = TRUE WHERE id = $1 AND published = TRUE AND seating_mode <> 'none' RETURNING *",
      [body.id],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Primero publica el evento y confirma que requiere reservaciones" }, { status: 409 });
    return NextResponse.json({ ok: true, event: result.rows[0] });
  }

  if (body.action === "close_reservations") {
    const result = await query("UPDATE events SET reservations_open = FALSE WHERE id = $1 RETURNING *", [body.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, event: result.rows[0] });
  }

  if (body.action === "update_price") {
    const seatPrice = money(body.seat_price);
    if (seatPrice === null) return NextResponse.json({ error: "El precio debe ser un importe válido" }, { status: 400 });
    const result = await query(
      "UPDATE events SET seat_price = $2 WHERE id = $1 AND seating_mode <> 'none' RETURNING *",
      [body.id, seatPrice],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Evento no encontrado o sin reservaciones" }, { status: 404 });
    return NextResponse.json({ ok: true, event: result.rows[0] });
  }

  const allowed = ["title", "description", "event_date", "location", "image_url"] as const;
  const entries = allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]] as const);
  if (!entries.length) return NextResponse.json({ error: "No hay cambios" }, { status: 400 });

  const values = entries.map(([, value]) => value);
  values.push(body.id);
  const set = entries.map(([key], index) => `"${key}" = $${index + 1}`).join(", ");
  try {
    await query(`UPDATE events SET ${set} WHERE id = $${values.length}`, values);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No fue posible actualizar el evento" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  try {
    await query("DELETE FROM events WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No fue posible eliminar el evento" }, { status: 500 });
  }
}
