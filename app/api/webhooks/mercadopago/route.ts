import { NextResponse, type NextRequest } from "next/server";
import { getMercadoPagoPayment, verifyMercadoPagoSignature } from "@/lib/mercado-pago";
import { reconcileMercadoPagoPayment } from "@/lib/mercado-pago-processing";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const dataId = String(req.nextUrl.searchParams.get("data.id") || body?.data?.id || "");
  if (!verifyMercadoPagoSignature({ signature: req.headers.get("x-signature"), requestId: req.headers.get("x-request-id"), dataId })) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  const type = String(req.nextUrl.searchParams.get("type") || body?.type || "");
  if (type !== "payment") return NextResponse.json({ received: true });
  try {
    const remote = await getMercadoPagoPayment(dataId);
    const paymentId = remote.external_reference || remote.metadata?.payment_id;
    if (!paymentId) return NextResponse.json({ received: true });
    await reconcileMercadoPagoPayment(paymentId, remote);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[mercadopago/webhook]", dataId, error);
    return NextResponse.json({ error: "No se pudo procesar la notificación" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook de Mercado Pago listo" });
}
