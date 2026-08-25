import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getEventVenueTables } from "@/lib/venue-layout";
import { canEditEvents, type Role } from "@/lib/permissions";
import EventReservationClient from "./EventReservationClient";

export const dynamic = "force-dynamic";
type EventRecord = { id: string; title: string; description: string | null; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned"; seat_plan_type: "architectural" | "custom"; capacity: number | null; seat_price: string | number; published: boolean; reservations_open: boolean };

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const eventResult = await query<EventRecord>("SELECT * FROM events WHERE id = $1 LIMIT 1", [id]);
  const event = eventResult.rows[0];
  if (!event || !user || (!event.published && !(user.status === "approved" && canEditEvents(user.role as Role)))) notFound();
  const [seatsResult, reservationResult, countResult, venueLayout] = await Promise.all([
    event.seating_mode === "assigned" ? query<{ id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number }>("SELECT id, row_label, seat_number, status, x, y, rotation FROM event_seats WHERE event_id = $1 ORDER BY row_label, seat_number", [id]) : Promise.resolve({ rows: [] }),
    query<{ id: string; seat_id: string | null; row_label: string | null; seat_number: number | null; x: number | null }>(`SELECT r.id, r.seat_id, s.row_label, s.seat_number, s.x FROM event_reservations r LEFT JOIN event_seats s ON s.id = r.seat_id WHERE r.event_id = $1 AND r.user_id = $2 ORDER BY s.row_label, s.seat_number`, [id, user.id]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM event_reservations WHERE event_id = $1", [id]),
    event.seating_mode === "assigned" ? getEventVenueTables(id) : Promise.resolve([]),
  ]);
  return <main className="min-h-screen bg-cream">
    <section className="bg-navy-deep px-6 py-16 text-cream sm:py-20"><div className="mx-auto max-w-5xl">
      <Link href="/eventos" className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-light hover:text-cream">← Todos los eventos</Link>
      <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold sm:text-5xl">{event.title}</h1>
      <p className="mt-5 text-sm text-cream/70">{new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} · {event.location || "Midrash Natán Torá"}</p>
      {event.seating_mode === "assigned" ? <p className="mt-3 text-sm font-semibold text-gold-light">{Number(event.seat_price) > 0 ? `$${Number(event.seat_price).toLocaleString("es-MX")} MXN por asiento` : "Evento gratuito"}</p> : null}
      {event.description ? <p className="mt-6 max-w-2xl leading-relaxed text-cream/80">{event.description}</p> : null}
    </div></section>
    <section className="px-3 py-8 sm:px-6 sm:py-16"><div className="mx-auto max-w-5xl"><EventReservationClient eventId={event.id} mode={event.seating_mode} planType={event.seat_plan_type ?? "architectural"} capacity={event.capacity} seatPrice={Number(event.seat_price ?? 0)} reservationsOpen={event.reservations_open} seats={seatsResult.rows} venueTables={venueLayout} existingReservations={reservationResult.rows} reservedCount={Number(countResult.rows[0]?.count ?? 0)} /></div></section>
  </main>;
}
