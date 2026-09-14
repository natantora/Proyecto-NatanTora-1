import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getEventVenueTables } from "@/lib/venue-layout";
import { canEditEvents, type Role } from "@/lib/permissions";
import EventReservationClient from "./EventReservationClient";
import { expireStaleEventReservations } from "@/lib/event-reservation-expiry";

export const dynamic = "force-dynamic";
type EventRecord = { id: string; title: string; description: string | null; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned" | "general"; seat_plan_type: "architectural" | "custom"; capacity: number | null; seat_price: string | number; published: boolean; reservations_open: boolean };
type PendingPayment = { id: string; expires_at: Date; seats: string[] };

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string; session_id?: string; payment_id?: string; internal_payment_id?: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const paymentParams = await searchParams;
  const eventResult = await query<EventRecord>("SELECT * FROM events WHERE id = $1 LIMIT 1", [id]);
  const event = eventResult.rows[0];
  const guestAccess = event?.published && event.seating_mode === "general";
  if (!event || (!user && !guestAccess) || (!event.published && !(user?.status === "approved" && canEditEvents(user.role as Role)))) notFound();
  await expireStaleEventReservations(id);
  const [seatsResult, reservationResult, pendingPaymentResult, countResult, venueLayout] = await Promise.all([
    event.seating_mode === "assigned" ? query<{ id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number; price: string | null }>("SELECT id, row_label, seat_number, status, x, y, rotation, price::text FROM event_seats WHERE event_id = $1 AND retired = FALSE ORDER BY row_label, seat_number", [id]) : Promise.resolve({ rows: [] }),
    user && event.seating_mode !== "general" ? query<{ id: string; seat_id: string | null; row_label: string | null; seat_number: number | null; x: number | null; unit_price: string }>(`SELECT r.id, r.seat_id, r.unit_price::text, s.row_label, s.seat_number, s.x FROM event_reservations r LEFT JOIN event_seats s ON s.id = r.seat_id WHERE r.event_id = $1 AND r.user_id = $2 AND r.status = 'confirmed' ORDER BY s.row_label, s.seat_number`, [id, user.id]) : Promise.resolve({ rows: [] }),
    user && event.seating_mode !== "general" ? query<PendingPayment>(
      `SELECT payment.id, MAX(reservation.expires_at) AS expires_at,
              ARRAY_AGG(CASE WHEN seat.x IS NOT NULL THEN seat.row_label ELSE CONCAT(seat.row_label, seat.seat_number) END ORDER BY seat.row_label, seat.seat_number) AS seats
         FROM payments payment
         JOIN event_reservations reservation ON reservation.payment_id = payment.id
    LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
        WHERE reservation.event_id = $1 AND reservation.user_id = $2
          AND reservation.status = 'pending' AND reservation.expires_at > NOW()
          AND payment.status = 'pending'
        GROUP BY payment.id
        ORDER BY MAX(reservation.created_at) DESC
        LIMIT 1`,
      [id, user.id],
    ) : Promise.resolve({ rows: [] as PendingPayment[] }),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM event_reservations reservation
      LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
      WHERE reservation.event_id = $1 AND (reservation.seat_id IS NULL OR seat.retired = FALSE)
        AND (reservation.status = 'confirmed' OR (reservation.status = 'pending' AND reservation.expires_at > NOW()))`, [id]),
    event.seating_mode === "assigned" ? getEventVenueTables(id) : Promise.resolve([]),
  ]);
  const assignedPrices = seatsResult.rows.map((seat) => Number(seat.price ?? event.seat_price ?? 0));
  const minimumSeatPrice = assignedPrices.length ? Math.min(...assignedPrices) : Number(event.seat_price ?? 0);
  const maximumSeatPrice = assignedPrices.length ? Math.max(...assignedPrices) : Number(event.seat_price ?? 0);
  const assignedPriceLabel = minimumSeatPrice === maximumSeatPrice
    ? minimumSeatPrice > 0 ? `$${minimumSeatPrice.toLocaleString("es-MX")} MXN por asiento` : "Evento gratuito"
    : `$${minimumSeatPrice.toLocaleString("es-MX")}–$${maximumSeatPrice.toLocaleString("es-MX")} MXN según el asiento`;
  return <main className="min-h-screen bg-cream">
    <section className="bg-navy-deep px-6 py-16 text-cream sm:py-20"><div className="mx-auto max-w-5xl">
      <Link href="/eventos" className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-light hover:text-cream">← Todos los eventos</Link>
      <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold sm:text-5xl">{event.title}</h1>
      <p className="mt-5 text-sm text-cream/70">{new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} · {event.location || "Midrash Natán Torá"}</p>
      {event.seating_mode === "assigned" ? <p className="mt-3 text-sm font-semibold text-gold-light">{assignedPriceLabel}</p> : null}
      {event.seating_mode === "general" ? <p className="mt-3 text-sm font-semibold text-gold-light">${Number(event.seat_price).toLocaleString("es-MX")} MXN por persona</p> : null}
      {event.description ? <p className="mt-6 max-w-2xl leading-relaxed text-cream/80">{event.description}</p> : null}
    </div></section>
    <section className="px-3 py-8 sm:px-6 sm:py-16"><div className="mx-auto max-w-5xl"><EventReservationClient key={`${pendingPaymentResult.rows[0]?.id ?? "none"}:${reservationResult.rows.map((reservation) => reservation.id).join(",")}:${seatsResult.rows.filter((seat) => seat.status === "occupied").length}:${seatsResult.rows.map((seat) => seat.price ?? "general").join(",")}`} eventId={event.id} mode={event.seating_mode} planType={event.seat_plan_type ?? "architectural"} capacity={event.capacity} seatPrice={Number(event.seat_price ?? 0)} reservationsOpen={event.reservations_open} seats={seatsResult.rows} venueTables={venueLayout} existingReservations={reservationResult.rows} pendingPayment={pendingPaymentResult.rows[0] ? { ...pendingPaymentResult.rows[0], expires_at: new Date(pendingPaymentResult.rows[0].expires_at).toISOString() } : null} reservedCount={Number(countResult.rows[0]?.count ?? 0)} paymentResult={paymentParams.payment === "success" ? "success" : paymentParams.payment === "pending" ? "pending" : paymentParams.payment === "cancelled" ? "cancelled" : null} sessionId={paymentParams.session_id || null} internalPaymentId={paymentParams.internal_payment_id || null} providerPaymentId={paymentParams.internal_payment_id ? paymentParams.payment_id || null : null} cancelledPaymentId={paymentParams.internal_payment_id || paymentParams.payment_id || null} currentUser={user ? { name: user.full_name || "", email: user.email, phone: user.phone || "" } : null} /></div></section>
  </main>;
}
