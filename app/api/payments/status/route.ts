import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMercadoPagoPayment, mercadoPagoConfigured } from "@/lib/mercado-pago";
import { reconcileMercadoPagoPayment } from "@/lib/mercado-pago-processing";
import { failCheckoutSession, failPendingPayment, finalizeCheckoutSession } from "@/lib/payment-processing";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { stripeClient, stripeConfigured } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  if (isRateLimited(`payment-status:${clientIp(req)}`, 40, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
  }
  const user = await getCurrentUser();
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim() || "";
  const internalPaymentId = req.nextUrl.searchParams.get("internal_payment_id")?.trim() || "";
  const providerPaymentId = req.nextUrl.searchParams.get("provider_payment_id")?.trim() || "";
  if ((!sessionId || !sessionId.startsWith("cs_")) && !internalPaymentId) return NextResponse.json({ error: "Sesión inválida" }, { status: 400 });
  const payment = await query<{ id: string; user_id: string | null; status: string; metadata: Record<string, unknown>; mercadopago_payment_id: string | null }>(
    sessionId
      ? "SELECT id, user_id, status, metadata, mercadopago_payment_id FROM payments WHERE stripe_session_id = $1 LIMIT 1"
      : "SELECT id, user_id, status, metadata, mercadopago_payment_id FROM payments WHERE id = $1 LIMIT 1",
    [sessionId || internalPaymentId],
  );
  if (!payment.rows[0]) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  if (payment.rows[0].user_id) {
    if (!user || payment.rows[0].user_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  } else {
    const eventId = typeof payment.rows[0].metadata?.event_id === "string" ? payment.rows[0].metadata.event_id : "";
    const guestEvent = eventId ? await query<{ id: string }>("SELECT id FROM events WHERE id = $1 AND seating_mode = 'general' LIMIT 1", [eventId]) : null;
    if (payment.rows[0].metadata?.kind !== "event" || !guestEvent?.rows[0]) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let status = payment.rows[0].status;
  if (!["paid", "refunded", "charged_back"].includes(status) && internalPaymentId && mercadoPagoConfigured() && (providerPaymentId || payment.rows[0].mercadopago_payment_id)) {
    try {
      const remote = await getMercadoPagoPayment(providerPaymentId || payment.rows[0].mercadopago_payment_id || "");
      if ((remote.external_reference || remote.metadata?.payment_id) === payment.rows[0].id) {
        await reconcileMercadoPagoPayment(payment.rows[0].id, remote);
      }
      const refreshed = await query<{ status: string }>("SELECT status FROM payments WHERE id = $1", [payment.rows[0].id]);
      status = refreshed.rows[0]?.status ?? status;
    } catch (error) {
      console.error("[payments/status/mercadopago]", error);
    }
  } else if (status === "pending" && sessionId && stripeConfigured()) {
    try {
      const session = await stripeClient().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") await finalizeCheckoutSession(session);
      else if (session.status === "expired") await failCheckoutSession(session);
      const refreshed = await query<{ status: string }>("SELECT status FROM payments WHERE id = $1", [payment.rows[0].id]);
      status = refreshed.rows[0]?.status ?? status;
    } catch (error) {
      console.error("[payments/status]", error);
    }
  }
  return NextResponse.json({ status, kind: payment.rows[0].metadata?.kind ?? null });
}

export async function DELETE(req: NextRequest) {
  if (isRateLimited(`payment-cancel:${clientIp(req)}`, 20, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const paymentId = req.nextUrl.searchParams.get("internal_payment_id")?.trim() || "";
  if (!paymentId) return NextResponse.json({ error: "Pago inválido" }, { status: 400 });
  const payment = await query<{ id: string; payment_method: string | null }>(
    "SELECT id, payment_method FROM payments WHERE id = $1 AND user_id = $2 AND status = 'pending' LIMIT 1",
    [paymentId, user.id],
  );
  // Volver desde Mercado Pago no demuestra que el cobro haya fallado. La
  // notificación firmada o la consulta al proveedor decide el estado final.
  if (payment.rows[0] && payment.rows[0].payment_method !== "mercadopago") await failPendingPayment(payment.rows[0].id);
  return NextResponse.json({ ok: true });
}
