// Tipos y constantes de la galería. SIN imports server-side
// para que se pueda usar tanto en client como server components.

export const BUCKET = "gallery";

const CATEGORIES = ["shabat", "fiesta", "clase", "evento", "general"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  shabat: "Shabat",
  fiesta: "Fiestas",
  clase: "Clases",
  evento: "Eventos",
  general: "General",
};

export const ALL_CATEGORIES: Category[] = [...CATEGORIES];

export type Photo = {
  path: string;
  publicUrl: string;
  category: Category;
  timestamp: number;
  caption: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

export type GalleryState =
  | { ok: true; photos: Photo[] }
  | { ok: false; reason: "no_bucket" }
  | { ok: false; reason: "error"; message: string };

export function isValidCategory(c: string): c is Category {
  return (CATEGORIES as readonly string[]).includes(c);
}

export const CATEGORIES_LIST = CATEGORIES;
