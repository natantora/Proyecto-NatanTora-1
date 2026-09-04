import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/data/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canEditGallery, type Role } from "@/lib/permissions";
import { deleteObjects, mediaUrl, putObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

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
  const sb = await createClient();
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
  const album = String(form.get("album") || "").trim().replace(/\s+/g, " ").slice(0, 80);

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
  const albumName = album || "General";
  const albumSlug = slugify(albumName) || "general";
  const directory = `gallery/${category}/${albumSlug}`;
  const path = `${directory}/${timestamp}${captionSlug}.${ext}`;

  const captionPath = `${directory}/${timestamp}.caption.txt`;
  const uploaderPath = `${directory}/${timestamp}.uploader.txt`;
  const albumPath = `${directory}/_album.txt`;
  try {
    await putObject(path, buf, file.type);
    await Promise.all([
      caption
        ? putObject(captionPath, Buffer.from(caption, "utf8"), "text/plain; charset=utf-8")
        : Promise.resolve(),
      putObject(uploaderPath, Buffer.from(user.id, "utf8"), "text/plain; charset=utf-8"),
      putObject(albumPath, Buffer.from(albumName, "utf8"), "text/plain; charset=utf-8"),
    ]);
  } catch (error) {
    console.error("[api/gallery POST] upload error:", error);
    await deleteObjects([path, captionPath, uploaderPath]).catch(() => undefined);
    return NextResponse.json({ error: "No se pudo guardar la foto" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    path,
    publicUrl: mediaUrl(path),
    caption: caption || null,
    category,
    album: albumName,
    timestamp,
  });
}

/**
 * DELETE /api/gallery?path=...
 * Borra una foto + sus sidecars
 */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
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
  if (![3, 4].includes(parts.length) || parts[0] !== "gallery" || !isValidCategory(parts[1])) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  // Extraer timestamp del filename
  const filename = parts.at(-1)!;
  const timestamp = filename.split(/[-.]/)[0];
  if (!/^\d+$/.test(timestamp)) {
    return NextResponse.json({ error: "Timestamp inválido en filename" }, { status: 400 });
  }

  const directory = parts.slice(0, -1).join("/");
  const captionPath = `${directory}/${timestamp}.caption.txt`;
  const uploaderPath = `${directory}/${timestamp}.uploader.txt`;
  try { await deleteObjects([path, captionPath, uploaderPath]); }
  catch (error) {
    console.error("[api/gallery DELETE] error:", error);
    return NextResponse.json({ error: "No se pudo borrar la foto" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
