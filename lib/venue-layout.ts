import { query, transaction } from "@/lib/db";

export type TableKind = "rect" | "round";

export type VenueTable = {
  id: string;
  kind: TableKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string | null;
};

export type VenueSeat = {
  id: string;
  x: number;
  y: number;
  label: string | null;
};

export async function getVenueLayout(): Promise<{ tables: VenueTable[]; seats: VenueSeat[] }> {
  const [tables, seats] = await Promise.all([
    query<VenueTable>("SELECT id, kind, x, y, width, height, rotation, label FROM venue_layout_tables ORDER BY created_at"),
    query<VenueSeat>("SELECT id, x, y, label FROM venue_layout_seats ORDER BY created_at"),
  ]);
  return { tables: tables.rows, seats: seats.rows };
}

export type NewVenueTable = { kind: TableKind; x: number; y: number; width: number; height: number; rotation: number; label: string | null };
export type NewVenueSeat = { x: number; y: number; label: string | null };

export async function replaceVenueLayout(tables: NewVenueTable[], seats: NewVenueSeat[]): Promise<void> {
  await transaction(async (client) => {
    await client.query("DELETE FROM venue_layout_tables");
    await client.query("DELETE FROM venue_layout_seats");

    if (tables.length) {
      const values: unknown[] = [];
      const groups = tables.map((t) => {
        values.push(t.kind, t.x, t.y, t.width, t.height, t.rotation, t.label);
        const o = values.length - 7;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`;
      });
      await client.query(
        `INSERT INTO venue_layout_tables (kind, x, y, width, height, rotation, label) VALUES ${groups.join(", ")}`,
        values,
      );
    }

    if (seats.length) {
      const values: unknown[] = [];
      const groups = seats.map((s) => {
        values.push(s.x, s.y, s.label);
        const o = values.length - 3;
        return `($${o + 1}, $${o + 2}, $${o + 3})`;
      });
      await client.query(`INSERT INTO venue_layout_seats (x, y, label) VALUES ${groups.join(", ")}`, values);
    }
  });
}
