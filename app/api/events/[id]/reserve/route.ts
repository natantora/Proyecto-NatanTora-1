import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transaction, query } from "@/lib/db";
import { failPendingPayment } from "@/lib/payment-processing";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { createMercadoPagoPreference, mercadoPagoConfigured } from "@/lib/mercado-pago";
import { publicSiteUrl, stripeClient, stripeConfigured } from "@/lib/stripe";
import { sendReservationConfirmation } from "@/lib/transactional-emails";
import { expireStaleEventReservations } from "@/lib/event-reservation-expiry";

type EventRecord = { id: string; title: string; event_date: Date; location: string | null; seating_mode: "none" | "open" | "assigned" | "general"; capacity: number | null; published: boolean; reservations_open: boolean; seat_price: string | number };

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (isRateLimited(`reserve:${clientIp(req)}`, 20, 10 * 60 * 1000)) return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en unos minutos." }, { status: 429 });
  const user = await getCurrentUser();
  const { id: eventId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const guestName = typeof body.holderName === "string" ? body.holderName.trim() : "";
  const guestAttendeeNames: string[] = Array.isArray(body.attendeeNames)
    ? body.attendeeNames.slice(0, 50).map((name: unknown) => typeof name === "string" ? name.trim() : "")
    : [];
  const guestEmail = typeof body.holderEmail === "string" ? body.holderEmail.trim().toLowerCase() : "";
  const guestPhone = typeof body.holderPhone === "string" ? body.holderPhone.trim() : "";
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
      if (event.seating_mode !== "general" && (!user || user.status !== "approved")) throw new Error("ACCOUNT_REQUIRED");
      const requestedQuantity = Number(body.quantity);
      const generalQuantity = event.seating_mode === "general" && Number.isInteger(requestedQuantity) ? requestedQuantity : 1;
      const attendeeNames = event.seating_mode === "general"
        ? guestAttendeeNames.length ? guestAttendeeNames : Array.from({ length: generalQuantity }, () => guestName)
        : [];
      const holderName = event.seating_mode === "general" ? attendeeNames[0] || "" : user?.full_name || user?.email || "";
      const holderEmail = event.seating_mode === "general" ? guestEmail : user?.email || "";
      const holderPhone = event.seating_mode === "general" ? guestPhone || user?.phone || null : user?.phone || null;
      if (event.seating_mode === "general" && (attendeeNames.length !== generalQuantity || attendeeNames.some((name) => name.length < 2 || name.length > 120))) throw new Error("ATTENDEE_NAMES_REQUIRED");
      const holderPhoneDigits = holderPhone.replace(/\D/g, "");
      if (event.seating_mode === "general" && (holderPhoneDigits.length < 8 || holderPhoneDigits.length > 15 || holderPhone.length > 40)) throw new Error("PHONE_REQUIRED");
      if (event.seating_mode === "general" && holderEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holderEmail) || holderEmail.length > 254)) throw new Error("EMAIL_INVALID");
      if (event.seating_mode === "general" && (generalQuantity < 1 || generalQuantity > 50)) throw new Error("QUANTITY_INVALID");
      const defaultUnitPrice = Number(event.seat_price ?? 0);
      if (event.seating_mode === "general" && defaultUnitPrice <= 0) throw new Error("PRICE_REQUIRED");
      // Mercado Pago puede tardar algunos minutos en entregar la aprobación.
      // El lugar se conserva un poco más que la vigencia del checkout para
      // evitar que se libere durante una aprobación válida.
      const holdMinutes = useMercadoPago ? 35 : 30;

      if (event.seating_mode !== "general") {
        const existing = await client.query(
          `SELECT id FROM event_reservations WHERE event_id = $1 AND user_id = $2
            AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW())) LIMIT 1`,
          [eventId, user?.id],
        );
        if (existing.rowCount) throw new Error("ALREADY_RESERVED");
      }

      let seats: { id: string; row_label: string; seat_number: number; x: number | null; unitPrice: number }[] = [];
      if (event.seating_mode === "open") {
        const countResult = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM event_reservations WHERE event_id = $1
            AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW()))`,
          [eventId],
        );
        if (Number(countResult.rows[0]?.count ?? 0) >= (event.capacity ?? 0)) throw new Error("SOLD_OUT");
      } else if (event.seating_mode === "assigned") {
        const requestedIds: unknown[] = Array.isArray(body.seatIds) ? body.seatIds : typeof body.seatId === "string" ? [body.seatId] : [];
        const seatIds = [...new Set(requestedIds.filter((seatId): seatId is string => typeof seatId === "string" && seatId.length > 0))].slice(0, 20);
        if (!seatIds.length) throw new Error("SEAT_REQUIRED");
        const seatResult = await client.query<{ id: string; row_label: string; seat_number: number; status: string; x: number | null; price: string | null }>(
          "SELECT id, row_label, seat_number, status, x, price::text FROM event_seats WHERE id = ANY($1::uuid[]) AND event_id = $2 AND retired = FALSE ORDER BY id FOR UPDATE",
          [seatIds, eventId],
        );
        if (seatResult.rows.length !== seatIds.length || seatResult.rows.some((seat) => seat.status !== "available")) throw new Error("SEAT_UNAVAILABLE");
        const byId = new Map(seatResult.rows.map((seat) => [seat.id, seat]));
        seats = seatIds
          .map((seatId) => byId.get(seatId))
          .filter((seat): seat is NonNullable<typeof seat> => Boolean(seat))
          .map((seat) => ({ ...seat, unitPrice: Number(seat.price ?? defaultUnitPrice) }));
      }

      const quantity = event.seating_mode === "general" ? generalQuantity : Math.max(1, seats.length);
      const total = Math.round((event.seating_mode === "general" ? defaultUnitPrice * quantity : seats.length ? seats.reduce((sum, seat) => sum + seat.unitPrice, 0) : defaultUnitPrice) * 100) / 100;
      if (total > 0 && body.policyAccepted !== true) throw new Error("POLICY_REQUIRED");
      if (total > 0 && !useMercadoPago && !stripeConfigured()) throw new Error("PAYMENTS_UNAVAILABLE");
      let paymentId: string | null = null;
      if (total > 0) {
        const payment = await client.query<{ id: string }>(
          `INSERT INTO payments
            (user_id, amount, currency, status, payment_method, donor_name, donor_email,
             description, metadata, expires_at)
           VALUES ($1, $2, 'MXN', 'pending', $7, $3, $4, $5,
                   jsonb_build_object('kind', 'event', 'event_id', $6::text, 'purchase_policy_version', '2026-09-01', 'purchase_policy_accepted', true), NOW() + ($8::INT * INTERVAL '1 minute'))
           RETURNING id`,
          [user?.id ?? null, total, holderName, holderEmail, `${quantity} ${quantity === 1 ? "entrada" : "entradas"} · ${event.title}`, eventId, useMercadoPago ? "mercadopago" : "stripe", holdMinutes],
        );
        paymentId = payment.rows[0].id;
        pendingPaymentId = paymentId;
      }

      const status = total > 0 ? "pending" : "confirmed";
      const reservations = event.seating_mode === "general"
        ? await client.query<{ id: string; event_id: string; seat_id: string | null; unit_price: string; created_at: Date }>(
          `INSERT INTO event_reservations
            (event_id, user_id, seat_id, holder_name, holder_email, holder_phone, unit_price, status, expires_at, payment_id)
           SELECT $1::uuid, $2::uuid, NULL, attendee_name, $4::text, $5::text, $6::numeric, $7::text,
                  CASE WHEN $7::text = 'pending' THEN NOW() + ($9::INT * INTERVAL '1 minute') ELSE NULL END, $8::uuid
             FROM unnest($3::text[]) AS attendee(attendee_name)
           RETURNING id, event_id, seat_id, unit_price, created_at`,
          [eventId, user?.id ?? null, attendeeNames, holderEmail, holderPhone, defaultUnitPrice, status, paymentId, holdMinutes],
        )
        : seats.length
        ? await client.query<{ id: string; event_id: string; seat_id: string | null; unit_price: string; created_at: Date }>(
          `INSERT INTO event_reservations
            (event_id, user_id, seat_id, holder_name, holder_email, holder_phone, unit_price, status, expires_at, payment_id)
           SELECT $1, $2, selected_seat_id, $5, $6, $7, selected_unit_price, $8,
                  CASE WHEN $8 = 'pending' THEN NOW() + ($10::INT * INTERVAL '1 minute') ELSE NULL END, $9
             FROM unnest($3::uuid[], $4::numeric[]) AS selected(selected_seat_id, selected_unit_price)
           RETURNING id, event_id, seat_id, unit_price, created_at`,
          [eventId, user?.id, seats.map((seat) => seat.id), seats.map((seat) => seat.unitPrice), holderName, holderEmail, holderPhone, status, paymentId, holdMinutes],
        )
        : await client.query<{ id: string; event_id: string; seat_id: string | null; unit_price: string; created_at: Date }>(
          `INSERT INTO event_reservations
            (event_id, user_id, seat_id, holder_name, holder_email, holder_phone, unit_price, status, expires_at, payment_id)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, $7,
                   CASE WHEN $7 = 'pending' THEN NOW() + ($9::INT * INTERVAL '1 minute') ELSE NULL END, $8)
           RETURNING id, event_id, seat_id, unit_price, created_at`,
          [eventId, user?.id, holderName, holderEmail, holderPhone, defaultUnitPrice, status, paymentId, holdMinutes],
        );
      if (seats.length) await client.query("UPDATE event_seats SET status = 'occupied' WHERE id = ANY($1::uuid[])", [seats.map((seat) => seat.id)]);
      const labels = seats.map((seat) => seat.x !== null ? seat.row_label : `${seat.row_label}${seat.seat_number}`);
      return { event, seats, reservations: reservations.rows, quantity, total, paymentId, labels, holderEmail };
    });

    if (result.paymentId) {
      if (useMercadoPago) {
        const preference = await createMercadoPagoPreference({ paymentId: result.paymentId, title: result.event.title, description: result.event.seating_mode === "general" ? `${result.quantity} ${result.quantity === 1 ? "entrada" : "entradas"} de acceso general` : result.seats.length ? `Asientos: ${result.labels.join(", ")}` : "Entrada con lugar libre", amount: result.total, email: result.holderEmail, kind: "event", returnPath: `/eventos/${eventId}`, expirationMinutes: 30 });
        await query("UPDATE payments SET mercadopago_preference_id = $2, provider_status = 'pending', provider_updated_at = NOW(), updated_at = NOW() WHERE id = $1", [result.paymentId, preference.id]);
        return NextResponse.json({ ok: true, requiresPayment: true, url: preference.url, paymentId: result.paymentId, provider: "mercadopago" });
      }
      const commonMetadata = { payment_id: result.paymentId, payment_kind: "event", event_id: eventId, ...(user?.id ? { user_id: user.id } : {}) };
      const session = await stripeClient().checkout.sessions.create({
        mode: "payment",
        customer_email: result.holderEmail || undefined,
        line_items: [{ price_data: { currency: "mxn", unit_amount: Math.round((result.event.seating_mode === "general" ? Number(result.event.seat_price) : result.total) * 100), product_data: { name: result.event.title, description: result.event.seating_mode === "general" ? "Entrada general" : result.seats.length ? `Asientos: ${result.labels.join(", ")}` : "Entrada con lugar libre" } }, quantity: result.event.seating_mode === "general" ? result.quantity : 1 }],
        metadata: commonMetadata,
        payment_intent_data: { metadata: commonMetadata },
        success_url: `${publicSiteUrl()}/eventos/${eventId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicSiteUrl()}/eventos/${eventId}?payment=cancelled&payment_id=${result.paymentId}`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      }, { idempotencyKey: result.paymentId });
      if (!session.url) throw new Error("CHECKOUT_FAILED");
      await query("UPDATE payments SET stripe_session_id = $2, updated_at = NOW() WHERE id = $1", [result.paymentId, session.id]);
      return NextResponse.json({ ok: true, requiresPayment: true, url: session.url, paymentId: result.paymentId, provider: "stripe" });
    }

    if (result.holderEmail) await sendReservationConfirmation({ email: result.holderEmail, memberName: guestName || user?.full_name || user?.email || "Invitado", eventId, eventTitle: result.event.title, eventDate: result.event.event_date, location: result.event.location || "Midrash Natán Torá", seats: result.event.seating_mode === "general" ? Array(result.quantity).fill("Entrada general") : result.labels, attendeeNames: result.event.seating_mode === "general" ? guestAttendeeNames : undefined, quantity: result.quantity, total: 0 }).catch((error) => console.error("[events/reserve] confirmation email failed:", error));
    return NextResponse.json({ ok: true, requiresPayment: false, reservations: result.reservations, seats: result.seats });
  } catch (error) {
    if (pendingPaymentId) await failPendingPayment(pendingPaymentId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    const responses: Record<string, [string, number]> = {
      EVENT_NOT_FOUND: ["Evento no encontrado", 404], NO_RESERVATIONS: ["Este evento no requiere reservación", 400],
      ACCOUNT_REQUIRED: ["Necesitas una cuenta aprobada", 401],
      RESERVATIONS_CLOSED: ["Las reservaciones todavía no están abiertas", 409],
      ALREADY_RESERVED: ["Ya tienes una reservación o un pago en proceso para este evento", 409], SOLD_OUT: ["Ya no hay lugares disponibles", 409],
      SEAT_REQUIRED: ["Selecciona al menos un asiento", 400], SEAT_UNAVAILABLE: ["Uno de esos asientos acaba de ser ocupado. Revisa tu selección.", 409],
      PAYMENTS_UNAVAILABLE: ["El pago de este evento no está disponible por el momento.", 503], CHECKOUT_FAILED: ["No fue posible abrir el pago seguro.", 500],
      POLICY_REQUIRED: ["Debes aceptar la política de compra antes de continuar.", 400],
      ATTENDEE_NAMES_REQUIRED: ["Escribe el nombre de cada persona", 400], PHONE_REQUIRED: ["Escribe un teléfono válido de 8 a 15 dígitos", 400], EMAIL_INVALID: ["El correo electrónico no es válido", 400],
      QUANTITY_INVALID: ["Puedes comprar de 1 a 50 entradas por pago", 400], PRICE_REQUIRED: ["Este evento todavía no tiene un precio válido", 409],
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
  const owned = await query<{ id: string; stripe_session_id: string | null; payment_method: string | null }>(
    `SELECT id, stripe_session_id, payment_method FROM payments WHERE id = $1 AND user_id = $2 AND status = 'pending'
      AND metadata->>'kind' = 'event' AND metadata->>'event_id' = $3 LIMIT 1`,
    [paymentId, user.id, eventId],
  );
  if (!owned.rows[0]) return NextResponse.json({ ok: true });
  if (owned.rows[0].payment_method === "mercadopago") {
    return NextResponse.json({ ok: true, pending: true, message: "Estamos confirmando el estado con Mercado Pago." });
  }
  if (owned.rows[0].stripe_session_id) {
    await stripeClient().checkout.sessions.expire(owned.rows[0].stripe_session_id).catch((error) => {
      console.error("[events/reserve] checkout expiration failed:", error);
      throw new Error("No se pudo cancelar la sesión de pago");
    });
  }
  await failPendingPayment(paymentId);
  return NextResponse.json({ ok: true });
}
