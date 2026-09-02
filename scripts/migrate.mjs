import { readFile } from "node:fs/promises";
import pg from "pg";
import { ARCHITECTURAL_SEATS } from "../lib/architectural-seat-map.js";
import { renumberSeatsByVisualOrder } from "../lib/seat-numbering.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL no esta configurada");

const sql = await readFile(new URL("../sql/railway-schema.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(sql);

  await client.query("BEGIN");
  try {
    await client.query("DELETE FROM architectural_plan_seats");
    const architecturalValues = [];
    const architecturalGroups = ARCHITECTURAL_SEATS.map((seat) => {
      architecturalValues.push(seat.seatNumber, seat.x, seat.y, seat.rotation, seat.label);
      const offset = architecturalValues.length - 4;
      return `($${offset}, $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });
    await client.query(
      `INSERT INTO architectural_plan_seats (seat_number, x, y, rotation, label)
       VALUES ${architecturalGroups.join(", ")}`,
      architecturalValues,
    );

    // Convierte los eventos existentes que usan el plano original sin cambiar
    // los IDs de los asientos ni perder reservaciones ya realizadas.
    await client.query(
      `UPDATE event_seats seat
          SET row_label = original.label,
              x = original.x,
              y = original.y,
              rotation = original.rotation
         FROM architectural_plan_seats original, events event
        WHERE seat.event_id = event.id
          AND event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'
          AND seat.row_label = original.label`,
    );
    await client.query(
      `INSERT INTO event_seats (event_id, row_label, seat_number, status, x, y, rotation)
       SELECT event.id, original.label, original.seat_number, 'available', original.x, original.y, original.rotation
         FROM events event
         CROSS JOIN architectural_plan_seats original
        WHERE event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'
          AND NOT EXISTS (
            SELECT 1 FROM event_seats seat
             WHERE seat.event_id = event.id
               AND seat.row_label = original.label
          )`,
    );
    await client.query(
      `UPDATE event_seats seat
          SET retired = TRUE,
              status = CASE WHEN EXISTS (
                SELECT 1 FROM event_reservations reservation
                 WHERE reservation.seat_id = seat.id
                   AND reservation.status IN ('pending', 'confirmed')
              ) THEN 'occupied' ELSE seat.status END
         FROM events event
        WHERE seat.event_id = event.id
          AND event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'
          AND seat.row_label = 'C08'`,
    );
    await client.query(
      `DELETE FROM event_seats seat
        USING events event
        WHERE seat.event_id = event.id
          AND event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'
          AND seat.row_label = 'C08'
          AND NOT EXISTS (
            SELECT 1 FROM event_reservations reservation WHERE reservation.seat_id = seat.id
          )`,
    );
    await client.query(
      `UPDATE events event
          SET capacity = counts.total
         FROM (
           SELECT event_id, COUNT(*)::int AS total
             FROM event_seats
            WHERE retired = FALSE
            GROUP BY event_id
         ) counts
        WHERE event.id = counts.event_id
          AND event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'`,
    );

    // Ordena una sola vez las etiquetas del plano personalizado sin mover
    // sillas ni tocar los asientos ya clonados en eventos existentes.
    const numberingMigration = await client.query(
      "SELECT 1 FROM app_migrations WHERE key = '2026-09-order-custom-seat-labels'",
    );
    if (!numberingMigration.rowCount) {
      const currentSeats = await client.query(
        "SELECT id, x, y, rotation, label FROM venue_layout_seats ORDER BY created_at, id",
      );
      if (currentSeats.rows.length) {
        const numberedSeats = renumberSeatsByVisualOrder(currentSeats.rows);
        await client.query(
          `UPDATE venue_layout_seats seat
              SET label = numbered.label
             FROM UNNEST($1::uuid[], $2::text[]) AS numbered(id, label)
            WHERE seat.id = numbered.id`,
          [numberedSeats.map((seat) => seat.id), numberedSeats.map((seat) => seat.label)],
        );
        await client.query(
          "INSERT INTO app_migrations (key) VALUES ('2026-09-order-custom-seat-labels')",
        );
      }
    }

    // Conserva los IDs y las reservaciones de eventos personalizados ya
    // creados; únicamente sincroniza su numeración con el orden visual.
    const eventNumberingMigration = await client.query(
      "SELECT 1 FROM app_migrations WHERE key = '2026-09-order-existing-custom-event-seat-labels'",
    );
    if (!eventNumberingMigration.rowCount) {
      const eventSeats = await client.query(
        `SELECT seat.id, seat.event_id, seat.x, seat.y, seat.row_label AS label
           FROM event_seats seat
           JOIN events event ON event.id = seat.event_id
          WHERE event.seating_mode = 'assigned'
            AND event.seat_plan_type = 'custom'
            AND seat.retired = FALSE
            AND seat.x IS NOT NULL
            AND seat.y IS NOT NULL
          ORDER BY seat.event_id, seat.created_at, seat.id`,
      );
      const seatsByEvent = Map.groupBy(eventSeats.rows, (seat) => seat.event_id);
      const numberedEventSeats = [...seatsByEvent.values()].flatMap((seats) =>
        renumberSeatsByVisualOrder(seats),
      );
      if (numberedEventSeats.length) {
        await client.query(
          `UPDATE event_seats seat
              SET row_label = numbered.label,
                  seat_number = numbered.label::integer
             FROM UNNEST($1::uuid[], $2::text[]) AS numbered(id, label)
            WHERE seat.id = numbered.id`,
          [numberedEventSeats.map((seat) => seat.id), numberedEventSeats.map((seat) => seat.label)],
        );
      }
      await client.query(
        "INSERT INTO app_migrations (key) VALUES ('2026-09-order-existing-custom-event-seat-labels')",
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  // Permite recuperar de forma segura la primera cuenta si se registró antes
  // de configurar INITIAL_OWNER_EMAIL. Solo promueve el correo configurado y
  // únicamente mientras todavía no exista ningún administrador o propietario.
  const initialOwnerEmail = (process.env.INITIAL_OWNER_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (initialOwnerEmail) {
    const promoted = await client.query(
      `UPDATE profiles
          SET role = 'owner', status = 'approved', updated_at = NOW()
        WHERE LOWER(email) = $1
          AND NOT EXISTS (
            SELECT 1 FROM profiles WHERE role IN ('admin', 'owner')
          )
        RETURNING id`,
      [initialOwnerEmail],
    );
    if (promoted.rowCount) {
      console.log("Cuenta propietaria inicial aprobada correctamente");
    }
  }

  console.log("Base de datos NatanTora actualizada correctamente");
} finally {
  await client.end();
}
