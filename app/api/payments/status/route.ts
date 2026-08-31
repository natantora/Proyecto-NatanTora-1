import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { failCheckoutSession, finalizeCheckoutSession } from "@/lib/payment-processing";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { stripeClient, stripeConfigured } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  if (isRateLimited(`payment-status:${clientIp(req)}`, 40, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
  }
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId || !sessionId.startsWith("cs_")) return NextResponse.json({ error: "Sesión inválida" }, { status: 400 });
  const payment = await query<{ id: string; status: string; metadata: Record<string, unknown> }>(
    "SELECT id, status, metadata FROM payments WHERE stripe_session_id = $1 LIMIT 1",
    [sessionId],
  );
  if (!payment.rows[0]) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  let status = payment.rows[0].status;
  if (status === "pending" && stripeConfigured()) {
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
