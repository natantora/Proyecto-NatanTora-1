import "server-only";
import {
  CATEGORIES_LIST,
  CATEGORY_LABEL,
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
    const photos = files.filter((f) => f.Key && !f.Key.endsWith(".caption.txt") && !f.Key.endsWith(".uploader.txt") && !f.Key.endsWith(".album.txt") && !f.Key.endsWith("/_album.txt"));
    const captionMap = new Map<string, string>();
    const uploaderMap = new Map<string, string>();
    const albumMap = new Map<string, string>();
    const captionFiles = files.filter((f) => f.Key?.endsWith(".caption.txt"));
    const uploaderFiles = files.filter((f) => f.Key?.endsWith(".uploader.txt"));
    const albumFiles = files.filter((f) => f.Key?.endsWith(".album.txt") || f.Key?.endsWith("/_album.txt"));

    await Promise.all([
      ...captionFiles.map(async (f) => {
        const data = await getObjectText(f.Key!);
        if (data) captionMap.set(f.Key!.replace(/\.caption\.txt$/, ""), data);
      }),
      ...uploaderFiles.map(async (f) => {
        const data = await getObjectText(f.Key!);
        if (data) uploaderMap.set(f.Key!.replace(/\.uploader\.txt$/, ""), data);
      }),
      ...albumFiles.map(async (f) => {
        const data = await getObjectText(f.Key!);
        if (!data) return;
        if (f.Key!.endsWith("/_album.txt")) {
          albumMap.set(f.Key!.slice(0, f.Key!.lastIndexOf("/") + 1), data);
        } else {
          albumMap.set(f.Key!.replace(/\.album\.txt$/, ""), data);
        }
      }),
    ]);

    for (const f of photos) {
      const path = f.Key!;
      const relativePath = path.slice(prefix.length);
      const segments = relativePath.split("/");
      const name = segments.at(-1)!;
      const timestamp = parseInt(name.split(/[-.]/)[0], 10);
      if (isNaN(timestamp)) continue;
      const directory = path.slice(0, path.lastIndexOf("/") + 1);
      const metadataKey = `${directory}${timestamp}`;
      const albumSlug = segments.length > 1 ? segments.at(-2)! : "";
      const fallbackAlbum = albumSlug
        ? albumSlug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
        : CATEGORY_LABEL[cat];
      all.push({
        path,
        publicUrl: mediaUrl(path),
        category: cat,
        album: albumMap.get(directory) || albumMap.get(metadataKey) || fallbackAlbum,
        timestamp,
        caption: captionMap.get(metadataKey) || null,
        uploadedBy: uploaderMap.get(metadataKey) || null,
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
