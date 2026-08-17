import "server-only";
import {
  CATEGORIES_LIST,
  type Photo,
  type GalleryState,
} from "./gallery";
import { getObjectText, listObjects, mediaUrl, storageReady } from "@/lib/storage";

export async function bucketExists(): Promise<boolean> {
  return storageReady();
}

export async function listPhotos(): Promise<Photo[]> {
  const all: Photo[] = [];

  for (const cat of CATEGORIES_LIST) {
    const prefix = `gallery/${cat}/`;
    const files = await listObjects(prefix);
    const photos = files.filter((f) => f.Key && !f.Key.endsWith(".caption.txt") && !f.Key.endsWith(".uploader.txt"));
    const captionMap = new Map<string, string>();
    const uploaderMap = new Map<string, string>();
    const captionFiles = files.filter((f) => f.Key?.endsWith(".caption.txt"));
    const uploaderFiles = files.filter((f) => f.Key?.endsWith(".uploader.txt"));

    await Promise.all([
      ...captionFiles.map(async (f) => {
        const name = f.Key!.slice(prefix.length);
        const ts = name.split(".")[0];
        const data = await getObjectText(f.Key!);
        if (data) captionMap.set(ts, data);
      }),
      ...uploaderFiles.map(async (f) => {
        const name = f.Key!.slice(prefix.length);
        const ts = name.split(".")[0];
        const data = await getObjectText(f.Key!);
        if (data) uploaderMap.set(ts, data);
      }),
    ]);

    for (const f of photos) {
      const path = f.Key!;
      const name = path.slice(prefix.length);
      const timestamp = parseInt(name.split(/[-.]/)[0], 10);
      if (isNaN(timestamp)) continue;
      const ts = String(timestamp);
      all.push({
        path,
        publicUrl: mediaUrl(path),
        category: cat,
        timestamp,
        caption: captionMap.get(ts) || null,
        uploadedBy: uploaderMap.get(ts) || null,
        createdAt: f.LastModified?.toISOString() || new Date(timestamp).toISOString(),
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
