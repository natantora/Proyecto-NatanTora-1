import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canEditEvents, type Role } from "@/lib/permissions";
import { getVenueLayout } from "@/lib/venue-layout";
import EventSeatsAdmin from "./EventSeatsAdmin";

export const dynamic = "force-dynamic";

type EventRecord = { id: string; title: string; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned"; capacity: number | null };
type SeatRow = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number };
type ReservationRow = { id: string; seat_id: string | null; holder_name: string; holder_email: string; holder_phone: string | null; created_at: string };

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canEditEvents(user.role as Role)) redirect("/admin/dashboard");

  const { id } = await params;
  const eventResult = await query<EventRecord>("SELECT id, title, event_date, location, seating_mode, capacity FROM events WHERE id = $1 LIMIT 1", [id]);
  const event = eventResult.rows[0];
  if (!event) notFound();

  const [seatsResult, reservationsResult, venueLayout] = await Promise.all([
    event.seating_mode === "assigned"
      ? query<SeatRow>("SELECT id, row_label, seat_number, status, x, y, rotation FROM event_seats WHERE event_id = $1 ORDER BY row_label, seat_number", [id])
      : Promise.resolve({ rows: [] as SeatRow[] }),
    query<ReservationRow>(
      "SELECT id, seat_id, holder_name, holder_email, holder_phone, created_at FROM event_reservations WHERE event_id = $1 ORDER BY created_at",
      [id],
    ),
    event.seating_mode === "assigned" ? getVenueLayout() : Promise.resolve({ tables: [], seats: [] }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/events" className="text-xs font-semibold uppercase tracking-wide text-midrash-500 hover:text-midrash-700">← Eventos</Link>
        <h1 className="mt-1 font-serif text-3xl font-bold text-midrash-900">{event.title}</h1>
        <p className="mt-1 text-sm text-midrash-600">
          {new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} · {event.location || "Midrash Natán Torá"}
        </p>
      </div>
      <EventSeatsAdmin
        seatingMode={event.seating_mode}
        capacity={event.capacity}
        seats={seatsResult.rows}
        reservations={reservationsResult.rows}
        venueTables={venueLayout.tables}
      />
    </div>
  );
}
