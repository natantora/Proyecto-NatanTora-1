export const PRODUCTION_SITE_ORIGIN = "https://natantora.com";

export function siteOrigin(fallback = "http://localhost:3000"): string {
  if (process.env.NODE_ENV === "production") return PRODUCTION_SITE_ORIGIN;

  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallback).replace(/\/$/, "");
}
