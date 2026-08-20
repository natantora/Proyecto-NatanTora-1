import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import EventReservationClient from "./EventReservationClient";

export const dynamic = "force-dynamic";
type EventRecord = { id: string; title: string; description: string | null; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned"; capacity: number | null };

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const eventResult = await query<EventRecord>("SELECT * FROM events WHERE id = $1 LIMIT 1", [id]);
  const event = eventResult.rows[0];
  if (!event || !user) notFound();
  const [seatsResult, reservationResult, countResult] = await Promise.all([
    event.seating_mode === "assigned" ? query<{ id: string; row_label: string; seat_number: number; status: "available" | "occupied" }>("SELECT id, row_label, seat_number, status FROM event_seats WHERE event_id = $1 ORDER BY row_label, seat_number", [id]) : Promise.resolve({ rows: [] }),
    query<{ id: string; seat_id: string | null; row_label: string | null; seat_number: number | null }>(`SELECT r.id, r.seat_id, s.row_label, s.seat_number FROM event_reservations r LEFT JOIN event_seats s ON s.id = r.seat_id WHERE r.event_id = $1 AND r.user_id = $2 LIMIT 1`, [id, user.id]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM event_reservations WHERE event_id = $1", [id]),
  ]);
  return <main className="min-h-screen bg-cream">
    <section className="bg-navy-deep px-6 py-16 text-cream sm:py-20"><div className="mx-auto max-w-5xl">
      <Link href="/eventos" className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-light hover:text-cream">← Todos los eventos</Link>
      <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold sm:text-5xl">{event.title}</h1>
      <p className="mt-5 text-sm text-cream/70">{new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} · {event.location || "Midrash Natán Torá"}</p>
      {event.description ? <p className="mt-6 max-w-2xl leading-relaxed text-cream/80">{event.description}</p> : null}
    </div></section>
    <section className="px-4 py-12 sm:px-6 sm:py-16"><div className="mx-auto max-w-5xl"><EventReservationClient eventId={event.id} mode={event.seating_mode} capacity={event.capacity} seats={seatsResult.rows} existingReservation={reservationResult.rows[0] ?? null} reservedCount={Number(countResult.rows[0]?.count ?? 0)} /></div></section>
  </main>;
}
