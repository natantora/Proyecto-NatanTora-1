import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import {
  canCreateOwnClasses,
  canEditAllClasses,
  canPublishDirectly,
  type Role,
} from "@/lib/permissions";

/**
 * POST /api/classes — crear clase
 * Insert tolerante a columnas opcionales (owner_id, pending_review).
 * Si la migración no ha corrido, se inserta sin ellas y se loggea aviso.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (await getUserRole(user.id)) as Role | null;
  if (!canCreateOwnClasses(role)) {
    return NextResponse.json({ error: "Sin permisos para crear clases" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sb = createAdminClient();

  const rabinoFlow = role === "rabino";
  const wantsPublished = !!body.published && canPublishDirectly(role);

  // Base payload con columnas que sabemos existen siempre
  const basePayload: Record<string, unknown> = {
    title: body.title,
    description: body.description ?? null,
    category: body.category ?? "General",
    media_type: body.media_type ?? "text",
    media_url: body.media_url ?? null,
    rabbi: body.rabbi ?? "Rab Natán",
    duration_minutes: body.duration_minutes ?? null,
    published: rabinoFlow ? false : wantsPublished,
    published_at: !rabinoFlow && wantsPublished ? new Date().toISOString() : null,
  };

  // Columnas opcionales (de migración de roles)
  const extendedPayload = {
    ...basePayload,
    owner_id: user.id,
    pending_review: rabinoFlow,
  };

  // Intentar con todas las columnas
  let { data, error } = await sb.from("classes").insert(extendedPayload).select().single();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    const isMissingCol = msg.includes("column") || (error as { code?: string }).code === "PGRST204";

    if (isMissingCol) {
      console.warn("[api/classes] Columnas owner_id/pending_review faltantes, retry sin ellas:", error.message);
      const retry = await sb.from("classes").insert(basePayload).select().single();
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) {
    console.error("[api/classes] insert failed:", JSON.stringify({
      message: error.message,
      code: (error as { code?: string }).code,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    }));
    return NextResponse.json({
      error: error.message,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
      code: (error as { code?: string }).code,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, class: data });
}

/**
 * PATCH /api/classes — editar clase
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (await getUserRole(user.id)) as Role | null;
  const { id, ...updates } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const sb = createAdminClient();
  const { data: existing } = await sb
    .from("classes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

  const isOwner = (existing as { owner_id?: string }).owner_id === user.id;

  if (!canEditAllClasses(role)) {
    if (!isOwner) {
      return NextResponse.json({ error: "Solo puedes editar tus propias clases" }, { status: 403 });
    }
    updates.pending_review = true;
    updates.published = false;
    updates.published_at = null;
    delete updates.owner_id;
  } else {
    if (updates.published === true && !updates.published_at) {
      updates.published_at = new Date().toISOString();
    }
    if (updates.published === true) {
      updates.pending_review = false;
    }
  }

  // Tolerar columnas que no existan
  let { error } = await sb.from("classes").update(updates).eq("id", id);
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("column") || (error as { code?: string }).code === "PGRST204") {
      // Retry sin las columnas nuevas
      const safeUpdates = { ...updates };
      delete (safeUpdates as Record<string, unknown>).pending_review;
      delete (safeUpdates as Record<string, unknown>).owner_id;
      const retry = await sb.from("classes").update(safeUpdates).eq("id", id);
      error = retry.error;
    }
  }

  if (error) {
    console.error("[api/classes PATCH] failed:", JSON.stringify({
      message: error.message,
      code: (error as { code?: string }).code,
      details: (error as { details?: string }).details,
    }));
    return NextResponse.json({
      error: error.message,
      details: (error as { details?: string }).details,
      code: (error as { code?: string }).code,
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/classes?id=...
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (await getUserRole(user.id)) as Role | null;
  if (!canEditAllClasses(role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Aceptar id desde query (?id=...) o desde JSON body { id: ... }
  let id = req.nextUrl.searchParams.get("id");
  if (!id) {
    const body = await req.json().catch(() => ({}));
    id = body?.id ?? null;
  }
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb.from("classes").delete().eq("id", id);
  if (error) {
    console.error("[api/classes DELETE] failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
