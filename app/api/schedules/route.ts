import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import { canEditHorarios, type Role } from "@/lib/permissions";

type TimeMode = "fixed" | "before_sunset" | "after_sunset";

async function authorized() {
  const user = await getCurrentUser();
  return !!user && user.status === "approved" && canEditHorarios(user.role as Role);
}

function payload(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const days = String(body.days ?? "").trim();
  const description = String(body.description ?? "").trim() || null;
  const timeMode: TimeMode = ["before_sunset", "after_sunset"].includes(String(body.time_mode))
    ? body.time_mode as TimeMode
    : "fixed";
  const time = timeMode === "fixed" ? String(body.time ?? "").trim() : null;
  const rawOffset = Number(body.offset_minutes ?? 0);
  const offset = timeMode === "fixed" ? 0 : timeMode === "before_sunset" ? -Math.abs(rawOffset) : Math.abs(rawOffset);
  const position = Number(body.position ?? 0);

  if (!name || !days) throw new Error("Nombre y días son obligatorios");
  if (timeMode === "fixed" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? "")) throw new Error("Escribe una hora válida");
  if (!Number.isInteger(offset) || offset < -240 || offset > 240) throw new Error("El ajuste debe estar entre -240 y 240 minutos");
  if (!Number.isInteger(position) || position < 0 || position > 1000) throw new Error("El orden no es válido");

  return {
    kind: "rezo",
    name,
    days,
    description,
    time,
    time_mode: timeMode,
    offset_minutes: offset,
    active: body.active !== false,
    position,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  try {
    const values = payload(await req.json().catch(() => ({})));
    const { data, error } = await createAdminClient().from("schedules").insert(values).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    const values = payload(body);
    const { data, error } = await createAdminClient().from("schedules").update(values).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const { error } = await createAdminClient().from("schedules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
