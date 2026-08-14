import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  BUCKET,
  CATEGORIES_LIST,
  type Photo,
  type GalleryState,
} from "./gallery";

export async function bucketExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.getBucket(BUCKET);
  if (error) return false;
  return !!data;
}

export async function listPhotos(): Promise<Photo[]> {
  const admin = createAdminClient();
  const all: Photo[] = [];

  for (const cat of CATEGORIES_LIST) {
    const { data: files, error } = await admin.storage.from(BUCKET).list(cat, {
      limit: 1000,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !files) continue;

    const photos = files.filter(
      (f) => !f.name.endsWith(".caption.txt") && !f.name.endsWith(".uploader.txt")
    );
    const captionMap = new Map<string, string>();
    const uploaderMap = new Map<string, string>();
    const captionFiles = files.filter((f) => f.name.endsWith(".caption.txt"));
    const uploaderFiles = files.filter((f) => f.name.endsWith(".uploader.txt"));

    await Promise.all([
      ...captionFiles.map(async (f) => {
        const ts = f.name.split(".")[0];
        const { data } = await admin.storage.from(BUCKET).download(`${cat}/${f.name}`);
        if (data) captionMap.set(ts, await data.text());
      }),
      ...uploaderFiles.map(async (f) => {
        const ts = f.name.split(".")[0];
        const { data } = await admin.storage.from(BUCKET).download(`${cat}/${f.name}`);
        if (data) uploaderMap.set(ts, await data.text());
      }),
    ]);

    for (const f of photos) {
      const timestamp = parseInt(f.name.split(/[-.]/)[0], 10);
      if (isNaN(timestamp)) continue;
      const ts = String(timestamp);
      const path = `${cat}/${f.name}`;
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      all.push({
        path,
        publicUrl: pub.publicUrl,
        category: cat,
        timestamp,
        caption: captionMap.get(ts) || null,
        uploadedBy: uploaderMap.get(ts) || null,
        createdAt: f.created_at || new Date(timestamp).toISOString(),
      });
    }
  }
  all.sort((a, b) => b.timestamp - a.timestamp);
  return all;
}

export async function readGallery(): Promise<GalleryState> {
  try {
    const exists = await bucketExists();
    if (!exists) return { ok: false, reason: "no_bucket" };
    const photos = await listPhotos();
    return { ok: true, photos };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Error",
    };
  }
}
