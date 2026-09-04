/**
 * Constantes para el sistema de medios de clases.
 * Los videos/audios se suben directo al Storage Bucket privado de Railway.
 * para evitar las limitaciones de embed de YouTube.
 */

export const CLASS_MEDIA_BUCKET = "class-media";

export const MAX_VIDEO_SIZE_MB = 500;
export const MAX_AUDIO_SIZE_MB = 100;
export const MAX_THUMBNAIL_SIZE_MB = 10;

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov (iPhone)
  "video/webm",
  "video/x-m4v",
  "video/mpeg",
];

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/mp4",  // .m4a
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
];

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ALL_MEDIA_TYPES = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES];

/**
 * Detecta si una URL es de nuestro almacenamiento (no YouTube/Vimeo)
 * Si lo es, el reproductor nativo HTML5 puede usarla directo.
 */
export function isStorageUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith("/api/media?key=");
}

export function youtubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "music.youtube.com") {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const id = parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : ["embed", "shorts", "live", "v"].includes(pathParts[0])
          ? pathParts[1]
          : null;
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
