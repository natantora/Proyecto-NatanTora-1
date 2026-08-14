import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canPromoteUsers } from "@/lib/permissions";
import {
  CLASS_MEDIA_BUCKET,
  MAX_VIDEO_SIZE_MB,
  ALL_MEDIA_TYPES,
} from "@/lib/class-media";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/setup-class-media
 * Crea el bucket public "class-media" en Supabase Storage.
 * Solo callable por owners. Idempotente.
 */
export async function POST() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = await getUserRole(user.id);
  if (!canPromoteUsers(role)) {
    return NextResponse.json({ error: "Solo propietarios pueden hacer esto" }, { status: 403 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // ¿Ya existe?
  const checkRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${CLASS_MEDIA_BUCKET}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  if (checkRes.ok) {
    return NextResponse.json({ ok: true, alreadyExists: true });
  }

  // Crear
  const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: CLASS_MEDIA_BUCKET,
      name: CLASS_MEDIA_BUCKET,
      public: true,
      file_size_limit: MAX_VIDEO_SIZE_MB * 1024 * 1024,
      allowed_mime_types: ALL_MEDIA_TYPES,
    }),
  });

  const body = await createRes.text();
  let parsed: unknown = body;
  try { parsed = JSON.parse(body); } catch {}

  if (!createRes.ok) {
    return NextResponse.json({
      ok: false,
      error: (parsed as { message?: string })?.message || "Error creando bucket",
      response: parsed,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, response: parsed });
}
