import { GetObjectCommand } from "@aws-sdk/client-s3";
import { bucketName, storageClient } from "@/lib/storage";

export const dynamic = "force-dynamic";

function isPublicMediaKey(key: string): boolean {
  if (key.includes("..") || key.startsWith("/") || key.endsWith(".txt")) return false;
  return key.startsWith("gallery/") || key.startsWith("class-media/");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  if (!isPublicMediaKey(key)) return new Response("Archivo invalido", { status: 400 });
  try {
    const range = request.headers.get("range") ?? undefined;
    const object = await storageClient().send(new GetObjectCommand({ Bucket: bucketName(), Key: key, Range: range }));
    const type = object.ContentType ?? "application/octet-stream";
    if (!type.startsWith("image/") && !type.startsWith("video/") && !type.startsWith("audio/")) {
      return new Response("Tipo de archivo no permitido", { status: 403 });
    }
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);
    return new Response(object.Body?.transformToWebStream(), { status: range ? 206 : 200, headers });
  } catch {
    return new Response("Archivo no encontrado", { status: 404 });
  }
}
