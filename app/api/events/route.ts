import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import { canEditEvents, type Role } from "@/lib/permissions";

async function isAuthorized() {
  const user = await getCurrentUser();
  return !!user && user.status === "approved" && canEditEvents(user.role as Role);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const supabase = createAdminClient();
  const payload = {
    title: body.title, description: body.description ?? null, event_date: body.event_date,
    location: body.location ?? "Midrash Natán Torá", image_url: body.image_url ?? null,
  };
  const { data, error } = await supabase.from("events").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, event: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id, ...updates } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("events").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
