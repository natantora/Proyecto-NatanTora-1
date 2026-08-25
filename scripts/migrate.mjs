import { readFile } from "node:fs/promises";
import pg from "pg";
import { ARCHITECTURAL_SEATS } from "../lib/architectural-seat-map.js";

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
    const architecturalGroups = ARCHITECTURAL_SEATS.map((seat, index) => {
      architecturalValues.push(index + 1, seat.x, seat.y, seat.rotation, seat.label);
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
          AND seat.seat_number = original.seat_number`,
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
               AND seat.seat_number = original.seat_number
          )`,
    );
    await client.query(
      `DELETE FROM event_seats seat
        USING events event
        WHERE seat.event_id = event.id
          AND event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'
          AND seat.seat_number > $1
          AND NOT EXISTS (
            SELECT 1 FROM event_reservations reservation WHERE reservation.seat_id = seat.id
          )`,
      [ARCHITECTURAL_SEATS.length],
    );
    await client.query(
      `UPDATE events event
          SET capacity = counts.total
         FROM (
           SELECT event_id, COUNT(*)::int AS total
             FROM event_seats
            GROUP BY event_id
         ) counts
        WHERE event.id = counts.event_id
          AND event.seating_mode = 'assigned'
          AND event.seat_plan_type = 'architectural'`,
    );
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
