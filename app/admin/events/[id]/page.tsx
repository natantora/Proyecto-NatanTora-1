import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canEditEvents, canManageSeats, type Role } from "@/lib/permissions";
import { getEventVenueTables } from "@/lib/venue-layout";
import EventSeatsAdmin from "./EventSeatsAdmin";
import EventPriceEditor from "./EventPriceEditor";

export const dynamic = "force-dynamic";

type EventRecord = { id: string; title: string; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned" | "general"; seat_plan_type: "architectural" | "custom"; capacity: number | null; seat_price: string | number; published: boolean; reservations_open: boolean };
type SeatRow = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number; price: string | null };
type ReservationRow = { id: string; seat_id: string | null; holder_name: string; holder_email: string; holder_phone: string | null; created_at: string; payment_id: string | null; status: "pending" | "confirmed"; unit_price: string };

export default async function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canEditEvents(user.role as Role)) redirect("/admin/dashboard");
  const canViewReservations = canManageSeats(user.role as Role);

  const { id } = await params;
  const eventResult = await query<EventRecord>("SELECT id, title, event_date, location, seating_mode, seat_plan_type, capacity, seat_price, published, reservations_open FROM events WHERE id = $1 LIMIT 1", [id]);
  const event = eventResult.rows[0];
  if (!event) notFound();

  const [seatsResult, reservationsResult, reservationCountResult, venueTables] = await Promise.all([
    event.seating_mode === "assigned"
      ? query<SeatRow>("SELECT id, row_label, seat_number, status, x, y, rotation, price::text FROM event_seats WHERE event_id = $1 AND retired = FALSE ORDER BY row_label, seat_number", [id])
      : Promise.resolve({ rows: [] as SeatRow[] }),
    canViewReservations
      ? query<ReservationRow>(
          "SELECT id, seat_id, holder_name, holder_email, holder_phone, created_at, payment_id, status, unit_price::text FROM event_reservations WHERE event_id = $1 AND status IN ('pending', 'confirmed') ORDER BY created_at",
          [id],
        )
      : Promise.resolve({ rows: [] as ReservationRow[] }),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM event_reservations reservation
      LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
      WHERE reservation.event_id = $1 AND (reservation.seat_id IS NULL OR seat.retired = FALSE)
        AND reservation.status IN ('pending', 'confirmed')`, [id]),
    event.seating_mode === "assigned" ? getEventVenueTables(id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/events" className="text-xs font-semibold uppercase tracking-wide text-midrash-500 hover:text-midrash-700">← Eventos</Link>
        <h1 className="mt-1 font-serif text-3xl font-bold text-midrash-900">{event.title}</h1>
        <p className="mt-1 text-sm text-midrash-600">
          {new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} · {event.location || "Midrash Natán Torá"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className={`rounded-full px-3 py-1 ${event.published ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>{event.published ? "Publicado" : "Borrador"}</span>{event.seating_mode !== "none" ? <span className={`rounded-full px-3 py-1 ${event.reservations_open ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{event.reservations_open ? "Reservaciones abiertas" : "Reservaciones cerradas"}</span> : null}{event.seating_mode === "assigned" ? <span className="rounded-full bg-gold/15 px-3 py-1 text-gold-deep">{Number(event.seat_price) > 0 ? `$${Number(event.seat_price).toLocaleString("es-MX")} MXN · precio general` : "Precio general gratuito"}</span> : event.seating_mode === "general" ? <span className="rounded-full bg-green-100 px-3 py-1 text-green-800">${Number(event.seat_price).toLocaleString("es-MX")} MXN por persona · acceso público</span> : null}</div>
      </div>
      {event.seating_mode !== "none" ? <EventPriceEditor eventId={event.id} initialPrice={Number(event.seat_price ?? 0)} label={event.seating_mode === "assigned" ? "Precio general por silla (MXN)" : event.seating_mode === "general" ? "Precio por persona (MXN)" : "Precio por lugar (MXN)"} allowFree={event.seating_mode !== "general"} /> : null}
      <EventSeatsAdmin
        eventId={event.id}
        seatingMode={event.seating_mode}
        planType={event.seat_plan_type ?? "architectural"}
        capacity={event.capacity}
        defaultSeatPrice={Number(event.seat_price ?? 0)}
        seats={seatsResult.rows}
        reservations={reservationsResult.rows}
        reservationCount={Number(reservationCountResult.rows[0]?.count ?? 0)}
        venueTables={venueTables}
        canViewReservations={canViewReservations}
      />
    </div>
  );
}
