import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction, query } from "@/lib/db";
import { failPendingPayment } from "@/lib/payment-processing";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { createMercadoPagoPreference, mercadoPagoConfigured } from "@/lib/mercado-pago";
import { publicSiteUrl, stripeClient, stripeConfigured } from "@/lib/stripe";
import { sendReservationConfirmation } from "@/lib/transactional-emails";
import { expireStaleEventReservations } from "@/lib/event-reservation-expiry";

type EventRecord = { id: string; title: string; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned"; capacity: number | null; published: boolean; reservations_open: boolean; seat_price: string | number };

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (isRateLimited(`reserve:${clientIp(req)}`, 20, 10 * 60 * 1000)) return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en unos minutos." }, { status: 429 });
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") return NextResponse.json({ error: "Necesitas una cuenta aprobada" }, { status: 401 });
  const { id: eventId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const useMercadoPago = mercadoPagoConfigured();
  let pendingPaymentId: string | null = null;

  try {
    await expireStaleEventReservations(eventId);
    const result = await transaction(async (client) => {
      const eventResult = await client.query<EventRecord>("SELECT id, title, event_date, location, seating_mode, capacity, published, reservations_open, seat_price FROM events WHERE id = $1 FOR UPDATE", [eventId]);
      const event = eventResult.rows[0];
      if (!event) throw new Error("EVENT_NOT_FOUND");
      if (event.seating_mode === "none") throw new Error("NO_RESERVATIONS");
      if (!event.published || !event.reservations_open) throw new Error("RESERVATIONS_CLOSED");
      const unitPrice = Number(event.seat_price ?? 0);
      if (unitPrice > 0 && !useMercadoPago && !stripeConfigured()) throw new Error("PAYMENTS_UNAVAILABLE");
      const holdMinutes = useMercadoPago ? 10 : 30;

      const existing = await client.query(
        `SELECT id FROM event_reservations WHERE event_id = $1 AND user_id = $2
          AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW())) LIMIT 1`,
        [eventId, user.id],
      );
      if (existing.rowCount) throw new Error("ALREADY_RESERVED");

      let seats: { id: string; row_label: string; seat_number: number; x: number | null }[] = [];
      if (event.seating_mode === "open") {
        const countResult = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM event_reservations WHERE event_id = $1
            AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW()))`,
          [eventId],
        );
        if (Number(countResult.rows[0]?.count ?? 0) >= (event.capacity ?? 0)) throw new Error("SOLD_OUT");
      } else {
        const requestedIds: unknown[] = Array.isArray(body.seatIds) ? body.seatIds : typeof body.seatId === "string" ? [body.seatId] : [];
        const seatIds = [...new Set(requestedIds.filter((seatId): seatId is string => typeof seatId === "string" && seatId.length > 0))].slice(0, 20);
        if (!seatIds.length) throw new Error("SEAT_REQUIRED");
        const seatResult = await client.query<{ id: string; row_label: string; seat_number: number; status: string; x: number | null }>(
          "SELECT id, row_label, seat_number, status, x FROM event_seats WHERE id = ANY($1::uuid[]) AND event_id = $2 ORDER BY id FOR UPDATE",
          [seatIds, eventId],
        );
        if (seatResult.rows.length !== seatIds.length || seatResult.rows.some((seat) => seat.status !== "available")) throw new Error("SEAT_UNAVAILABLE");
        const byId = new Map(seatResult.rows.map((seat) => [seat.id, seat]));
        seats = seatIds.map((seatId) => byId.get(seatId)).filter((seat): seat is NonNullable<typeof seat> => Boolean(seat));
      }

      const quantity = Math.max(1, seats.length);
      const total = Math.round(unitPrice * quantity * 100) / 100;
      let paymentId: string | null = null;
      if (total > 0) {
        const payment = await client.query<{ id: string }>(
          `INSERT INTO payments
            (user_id, amount, currency, status, payment_method, donor_name, donor_email,
             description, metadata, expires_at)
           VALUES ($1, $2, 'MXN', 'pending', $7, $3, $4, $5,
                   jsonb_build_object('kind', 'event', 'event_id', $6::text), NOW() + ($8::INT * INTERVAL '1 minute'))
           RETURNING id`,
          [user.id, total, user.full_name || user.email, user.email, `${quantity} ${quantity === 1 ? "lugar" : "lugares"} · ${event.title}`, eventId, useMercadoPago ? "mercadopago" : "stripe", holdMinutes],
        );
        paymentId = payment.rows[0].id;
        pendingPaymentId = paymentId;
      }

      const status = total > 0 ? "pending" : "confirmed";
      const reservations = seats.length
        ? await client.query<{ id: string; event_id: string; seat_id: string | null; created_at: Date }>(
          `INSERT INTO event_reservations
            (event_id, user_id, seat_id, holder_name, holder_email, holder_phone, unit_price, status, expires_at, payment_id)
           SELECT $1, $2, selected_seat_id, $4, $5, $6, $7, $8,
                  CASE WHEN $8 = 'pending' THEN NOW() + ($10::INT * INTERVAL '1 minute') ELSE NULL END, $9
             FROM unnest($3::uuid[]) AS selected_seat_id
           RETURNING id, event_id, seat_id, created_at`,
          [eventId, user.id, seats.map((seat) => seat.id), user.full_name || user.email, user.email, user.phone, unitPrice, status, paymentId, holdMinutes],
        )
        : await client.query<{ id: string; event_id: string; seat_id: string | null; created_at: Date }>(
          `INSERT INTO event_reservations
            (event_id, user_id, seat_id, holder_name, holder_email, holder_phone, unit_price, status, expires_at, payment_id)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, $7,
                   CASE WHEN $7 = 'pending' THEN NOW() + ($9::INT * INTERVAL '1 minute') ELSE NULL END, $8)
           RETURNING id, event_id, seat_id, created_at`,
          [eventId, user.id, user.full_name || user.email, user.email, user.phone, unitPrice, status, paymentId, holdMinutes],
        );
      if (seats.length) await client.query("UPDATE event_seats SET status = 'occupied' WHERE id = ANY($1::uuid[])", [seats.map((seat) => seat.id)]);
      const labels = seats.map((seat) => seat.x !== null ? seat.row_label : `${seat.row_label}${seat.seat_number}`);
      return { event, seats, reservations: reservations.rows, quantity, total, paymentId, labels };
    });

    if (result.paymentId) {
      if (useMercadoPago) {
        const preference = await createMercadoPagoPreference({ paymentId: result.paymentId, title: result.event.title, description: result.seats.length ? `Asientos: ${result.labels.join(", ")}` : "Entrada con lugar libre", amount: result.total, email: user.email, kind: "event", returnPath: `/eventos/${eventId}`, expirationMinutes: 10 });
        await query("UPDATE payments SET mercadopago_preference_id = $2, updated_at = NOW() WHERE id = $1", [result.paymentId, preference.id]);
        return NextResponse.json({ ok: true, requiresPayment: true, url: preference.url, provider: "mercadopago" });
      }
      const commonMetadata = { payment_id: result.paymentId, payment_kind: "event", event_id: eventId, user_id: user.id };
      const session = await stripeClient().checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        line_items: [{ price_data: { currency: "mxn", unit_amount: Math.round(Number(result.event.seat_price) * 100), product_data: { name: result.event.title, description: result.seats.length ? `Asientos: ${result.labels.join(", ")}` : "Entrada con lugar libre" } }, quantity: result.quantity }],
        metadata: commonMetadata,
        payment_intent_data: { metadata: commonMetadata },
        success_url: `${publicSiteUrl()}/eventos/${eventId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicSiteUrl()}/eventos/${eventId}?payment=cancelled&payment_id=${result.paymentId}`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      }, { idempotencyKey: result.paymentId });
      if (!session.url) throw new Error("CHECKOUT_FAILED");
      await query("UPDATE payments SET stripe_session_id = $2, updated_at = NOW() WHERE id = $1", [result.paymentId, session.id]);
      return NextResponse.json({ ok: true, requiresPayment: true, url: session.url, provider: "stripe" });
    }

    await sendReservationConfirmation({ email: user.email, memberName: user.full_name || user.email, eventId, eventTitle: result.event.title, eventDate: result.event.event_date, location: result.event.location || "Midrash Natán Torá", seats: result.labels, quantity: result.quantity, total: 0 }).catch((error) => console.error("[events/reserve] confirmation email failed:", error));
    return NextResponse.json({ ok: true, requiresPayment: false, reservations: result.reservations, seats: result.seats });
  } catch (error) {
    if (pendingPaymentId) await failPendingPayment(pendingPaymentId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    const responses: Record<string, [string, number]> = {
      EVENT_NOT_FOUND: ["Evento no encontrado", 404], NO_RESERVATIONS: ["Este evento no requiere reservación", 400],
      RESERVATIONS_CLOSED: ["Las reservaciones todavía no están abiertas", 409],
      ALREADY_RESERVED: ["Ya tienes una reservación o un pago en proceso para este evento", 409], SOLD_OUT: ["Ya no hay lugares disponibles", 409],
      SEAT_REQUIRED: ["Selecciona al menos un asiento", 400], SEAT_UNAVAILABLE: ["Uno de esos asientos acaba de ser ocupado. Revisa tu selección.", 409],
      PAYMENTS_UNAVAILABLE: ["El pago de este evento no está disponible por el momento.", 503], CHECKOUT_FAILED: ["No fue posible abrir el pago seguro.", 500],
    };
    const [text, status] = responses[message] ?? ["No fue posible completar la reservación", 500];
    console.error("[events/reserve]", error);
    return NextResponse.json({ error: text }, { status });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: eventId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  if (!paymentId) return NextResponse.json({ error: "Pago inválido" }, { status: 400 });
  const owned = await query<{ id: string; stripe_session_id: string | null }>(
    `SELECT id, stripe_session_id FROM payments WHERE id = $1 AND user_id = $2 AND status = 'pending'
      AND metadata->>'kind' = 'event' AND metadata->>'event_id' = $3 LIMIT 1`,
    [paymentId, user.id, eventId],
  );
  if (!owned.rows[0]) return NextResponse.json({ ok: true });
  if (owned.rows[0].stripe_session_id) {
    await stripeClient().checkout.sessions.expire(owned.rows[0].stripe_session_id).catch((error) => {
      console.error("[events/reserve] checkout expiration failed:", error);
      throw new Error("No se pudo cancelar la sesión de pago");
    });
  }
  await failPendingPayment(paymentId);
  return NextResponse.json({ ok: true });
}
