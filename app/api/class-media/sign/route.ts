import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canCreateOwnClasses, type Role } from "@/lib/permissions";
import {
  CLASS_MEDIA_BUCKET,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
} from "@/lib/class-media";

export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

/**
 * POST /api/class-media/sign
 * Body JSON: { filename: string, contentType: string, kind: 'video' | 'audio' }
 * Retorna { signedUrl, token, path, publicUrl }
 *
 * El cliente (browser) usa signedUrl + token para subir el archivo
 * DIRECTO a Supabase Storage (bypaseando el límite 4.5MB de Vercel).
 */
export async function POST(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = (await getUserRole(user.id)) as Role | null;
  if (!canCreateOwnClasses(role)) {
    return NextResponse.json({ error: "Sin permisos para subir clases" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const filename: string = String(body?.filename || "");
  const contentType: string = String(body?.contentType || "");
  const kind: string = String(body?.kind || "");

  if (!filename || !contentType) {
    return NextResponse.json({ error: "Falta filename o contentType" }, { status: 400 });
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);
  const isAudio = ALLOWED_AUDIO_TYPES.includes(contentType);
  if (!isVideo && !isAudio) {
    return NextResponse.json({
      error: `Formato no permitido: ${contentType}. Usa MP4, MOV, WebM (video) o MP3, M4A, WAV (audio).`
    }, { status: 400 });
  }
  if (kind === "video" && !isVideo) {
    return NextResponse.json({ error: "El archivo no es de video" }, { status: 400 });
  }
  if (kind === "audio" && !isAudio) {
    return NextResponse.json({ error: "El archivo no es de audio" }, { status: 400 });
  }

  // Generar path único
  const ext = (filename.split(".").pop() || (isVideo ? "mp4" : "mp3")).toLowerCase().slice(0, 5);
  const baseName = filename.replace(/\.[^.]+$/, "");
  const slug = slugify(baseName) || (isVideo ? "video" : "audio");
  const timestamp = Date.now();
  const folder = isVideo ? "video" : "audio";
  const path = `${folder}/${timestamp}-${slug}.${ext}`;

  // Crear signed upload URL con service_role
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(CLASS_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[api/class-media/sign] createSignedUploadUrl error:", error);
    return NextResponse.json({
      error: error?.message || "Error generando URL de subida"
    }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(CLASS_MEDIA_BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: pub.publicUrl,
  });
}
