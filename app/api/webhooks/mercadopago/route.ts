import { NextResponse, type NextRequest } from "next/server";
import { getMercadoPagoPayment, verifyMercadoPagoSignature } from "@/lib/mercado-pago";
import { reconcileMercadoPagoPayment } from "@/lib/mercado-pago-processing";
import { reportSystemAlert } from "@/lib/system-alerts";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const signedDataId = req.nextUrl.searchParams.get("data.id");
  const dataId = String(signedDataId || body?.data?.id || "");
  if (!verifyMercadoPagoSignature({
    signature: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId: signedDataId,
  })) {
    await reportSystemAlert({ severity: "warning", category: "webhook", title: "Notificación de Mercado Pago rechazada", message: "Llegó una notificación con firma inválida. No se modificó ningún pago.", fingerprint: "webhook:mercadopago:invalid-signature", context: { data_id: dataId || null } });
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
    await reportSystemAlert({ severity: "critical", category: "webhook", title: "No se pudo procesar un pago de Mercado Pago", message: error instanceof Error ? error.message : String(error), fingerprint: `webhook:mercadopago:processing:${dataId || "unknown"}`, context: { data_id: dataId || null } });
    return NextResponse.json({ error: "No se pudo procesar la notificación" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "webhook de Mercado Pago listo" });
}
