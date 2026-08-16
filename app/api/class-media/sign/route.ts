import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/data/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canCreateOwnClasses, type Role } from "@/lib/permissions";
import {
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
} from "@/lib/class-media";
import { mediaUrl, signedUploadUrl } from "@/lib/storage";

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
 * Retorna { signedUrl, path, publicUrl }
 *
 * El cliente (browser) usa signedUrl + token para subir el archivo
 * DIRECTO al Storage Bucket privado de Railway.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
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
  const path = `class-media/${folder}/${timestamp}-${slug}.${ext}`;

  try {
    const signedUrl = await signedUploadUrl(path, contentType);
    return NextResponse.json({
      ok: true,
      signedUrl,
      path,
      publicUrl: mediaUrl(path),
    });
  } catch (error) {
    console.error("[api/class-media/sign] signedUploadUrl error:", error);
    return NextResponse.json({
      error: "El almacenamiento de Railway aún no está configurado"
    }, { status: 500 });
  }
}
