/**
 * Constantes para el sistema de medios de clases.
 * Los videos/audios se suben directo a Supabase Storage (bucket "class-media")
 * para evitar las limitaciones de embed de YouTube.
 */

export const CLASS_MEDIA_BUCKET = "class-media";

export const MAX_VIDEO_SIZE_MB = 500;
export const MAX_AUDIO_SIZE_MB = 100;

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

export const ALL_MEDIA_TYPES = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES];

/**
 * Detecta si una URL es de nuestro Supabase Storage (no YouTube/Vimeo)
 * Si lo es, el reproductor nativo HTML5 puede usarla directo.
 */
export function isStorageUrl(url: string): boolean {
  if (!url) return false;
  return /supabase\.co\/storage\/v1\/object\/public\//.test(url);
}
