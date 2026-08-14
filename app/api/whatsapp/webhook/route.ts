import { NextResponse, type NextRequest } from "next/server";

/**
 * Meta requiere un webhook GET para verificar la URL al configurar
 * la app de WhatsApp Business. Devolvemos el hub.challenge si el
 * verify_token coincide con el de env.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && token === expectedToken) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST: Meta envía aquí los mensajes recibidos. Por ahora solo
 * registramos en log. Futuro: parsear "Aprobar" / "Rechazar" como
 * comandos de admin via WhatsApp.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[whatsapp] inbound:", JSON.stringify(body));
  } catch (e) {
    console.error("[whatsapp] webhook parse error:", e);
  }
  return NextResponse.json({ ok: true });
}
