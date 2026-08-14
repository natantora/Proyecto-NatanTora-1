import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canEditGallery, type Role } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";
const CATEGORIES = ["shabat", "fiesta", "clase", "evento", "general"] as const;
type Category = (typeof CATEGORIES)[number];

function isValidCategory(c: string): c is Category {
  return (CATEGORIES as readonly string[]).includes(c);
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * POST /api/gallery — sube una foto
 * FormData: file (File), category (string), caption (string opcional)
 */
export async function POST(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = (await getUserRole(user.id)) as Role | null;
  if (!canEditGallery(role)) {
    return NextResponse.json({ error: "Sin permisos para subir fotos" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const category = String(form.get("category") || "general");
  const caption = String(form.get("caption") || "").trim().slice(0, 200);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta archivo" }, { status: 400 });
  }
  if (!isValidCategory(category)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Foto demasiado grande (máx 25MB)" }, { status: 400 });
  }
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: `Formato no permitido: ${file.type}` }, { status: 400 });
  }

  // Convertir a Buffer
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 4);
  const timestamp = Date.now();
  const captionSlug = caption ? "-" + slugify(caption) : "";
  const path = `${category}/${timestamp}${captionSlug}.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) {
    console.error("[api/gallery POST] upload error:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Embebemos caption + uploader en una "tag" adicional via lista de tags vacía
  // (no podemos tocar user_metadata via service_role del lado del cliente JS,
  // así que el caption se queda en el filename como slug + un sidecar JSON pequeño)
  if (caption) {
    const sidecarPath = `${category}/${timestamp}.caption.txt`;
    await admin.storage.from(BUCKET).upload(sidecarPath, Buffer.from(caption, "utf8"), {
      contentType: "text/plain; charset=utf-8",
      upsert: true,
    });
  }
  const uploaderPath = `${category}/${timestamp}.uploader.txt`;
  await admin.storage.from(BUCKET).upload(uploaderPath, Buffer.from(user.id, "utf8"), {
    contentType: "text/plain; charset=utf-8",
    upsert: true,
  });

  // URL pública
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    path,
    publicUrl: pub.publicUrl,
    caption: caption || null,
    category,
    timestamp,
  });
}

/**
 * DELETE /api/gallery?path=...
 * Borra una foto + sus sidecars
 */
export async function DELETE(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = (await getUserRole(user.id)) as Role | null;
  if (!canEditGallery(role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Falta path" }, { status: 400 });

  // Path debe ser en la forma {category}/{timestamp}.{ext}
  const parts = path.split("/");
  if (parts.length !== 2 || !isValidCategory(parts[0])) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  // Extraer timestamp del filename
  const filename = parts[1];
  const timestamp = filename.split(/[-.]/)[0];
  if (!/^\d+$/.test(timestamp)) {
    return NextResponse.json({ error: "Timestamp inválido en filename" }, { status: 400 });
  }

  const admin = createAdminClient();
  const captionPath = `${parts[0]}/${timestamp}.caption.txt`;
  const uploaderPath = `${parts[0]}/${timestamp}.uploader.txt`;

  const { error } = await admin.storage.from(BUCKET).remove([path, captionPath, uploaderPath]);
  if (error) {
    console.error("[api/gallery DELETE] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
