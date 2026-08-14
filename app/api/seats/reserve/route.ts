import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.seatId || !body?.holder_name || !body?.holder_email) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("seats").update({
    status: "reserved", holder_name: body.holder_name, holder_email: body.holder_email,
    holder_phone: body.holder_phone ?? null, reserved_at: new Date().toISOString(),
  }).eq("id", body.seatId).eq("status", "available").select().single();
  if (error || !data) return NextResponse.json({ error: "Este asiento ya no está disponible" }, { status: 409 });
  return NextResponse.json({ ok: true, seat: data });
}
