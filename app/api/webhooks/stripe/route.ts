import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json({ ok: false, message: "Stripe no configurado. Ver instrucciones en el código." }, { status: 501 });
}

export async function GET() {
  return NextResponse.json({ status: "webhook endpoint listo (sin Stripe)" });
}
