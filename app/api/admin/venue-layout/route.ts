import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageSeats, type Role } from "@/lib/permissions";
import { getVenueLayout, replaceVenueLayout, type NewVenueSeat, type NewVenueTable } from "@/lib/venue-layout";

async function isAuthorized() {
  const user = await getCurrentUser();
  return !!user && user.status === "approved" && canManageSeats(user.role as Role);
}

export async function GET() {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const layout = await getVenueLayout();
  return NextResponse.json(layout);
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.tables) || !Array.isArray(body?.seats)) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  if (body.tables.length > 200 || body.seats.length > 1000) {
    return NextResponse.json({ error: "Demasiados elementos en el plano" }, { status: 400 });
  }

  const tables: NewVenueTable[] = body.tables.map((t: Record<string, unknown>) => ({
    kind: t.kind === "round" ? "round" : "rect",
    x: Number(t.x) || 0,
    y: Number(t.y) || 0,
    width: Math.max(10, Number(t.width) || 60),
    height: Math.max(10, Number(t.height) || 60),
    rotation: Number(t.rotation) || 0,
    label: typeof t.label === "string" && t.label.trim() ? t.label.trim().slice(0, 60) : null,
  }));
  const seats: NewVenueSeat[] = body.seats.map((s: Record<string, unknown>) => ({
    x: Number(s.x) || 0,
    y: Number(s.y) || 0,
    label: typeof s.label === "string" && s.label.trim() ? s.label.trim().slice(0, 20) : null,
  }));

  await replaceVenueLayout(tables, seats);
  return NextResponse.json({ ok: true, tableCount: tables.length, seatCount: seats.length });
}
