"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CATEGORY_LABEL, type Photo } from "@/lib/gallery";

type Album = {
  name: string;
  photos: Photo[];
};

export default function GalleryClient({ photos }: { photos: Photo[] }) {
  const albums = useMemo<Album[]>(() => {
    const grouped = new Map<string, Photo[]>();
    for (const photo of photos) {
      const current = grouped.get(photo.album) ?? [];
      current.push(photo);
      grouped.set(photo.album, current);
    }
    return Array.from(grouped, ([name, albumPhotos]) => ({ name, photos: albumPhotos }))
      .sort((a, b) => (b.photos[0]?.timestamp ?? 0) - (a.photos[0]?.timestamp ?? 0));
  }, [photos]);

  const [activeAlbumName, setActiveAlbumName] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activeAlbum = albums.find((album) => album.name === activeAlbumName) ?? null;
  const lightboxPhoto = activeAlbum && lightboxIndex !== null ? activeAlbum.photos[lightboxIndex] : null;

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function moveLightbox(direction: -1 | 1) {
    if (!activeAlbum || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + direction + activeAlbum.photos.length) % activeAlbum.photos.length);
  }

  useEffect(() => {
    if (lightboxIndex === null || !activeAlbum) return;
    const photoCount = activeAlbum.photos.length;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => current === null ? null : (current - 1 + photoCount) % photoCount);
      }
      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => current === null ? null : (current + 1) % photoCount);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxIndex, activeAlbum]);

  if (!activeAlbum) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => {
          const cover = album.photos[0];
          const categories = Array.from(new Set(album.photos.map((photo) => CATEGORY_LABEL[photo.category])));
          return (
            <button
              key={album.name}
              type="button"
              onClick={() => setActiveAlbumName(album.name)}
              className="group border border-line bg-cream-light text-left transition-colors hover:border-gold"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-cream-dark">
                <Image
                  src={cover.publicUrl}
                  alt={`Álbum ${album.name}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  unoptimized
                />
              </div>
              <div className="flex items-end justify-between gap-4 p-5">
                <div>
                  <div className="serif-display text-[25px] leading-tight text-navy">{album.name}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    {categories.join(" · ")}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-deep">
                  {album.photos.length} {album.photos.length === 1 ? "foto" : "fotos"} →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <button
            type="button"
            onClick={() => { setActiveAlbumName(null); closeLightbox(); }}
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-deep hover:text-navy"
          >
            ← Volver a álbumes
          </button>
          <h2 className="serif-display text-[34px] leading-none text-navy lg:text-[44px]">{activeAlbum.name}</h2>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          {activeAlbum.photos.length} {activeAlbum.photos.length === 1 ? "foto" : "fotos"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {activeAlbum.photos.map((photo, index) => (
          <button
            key={photo.path}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group relative aspect-square overflow-hidden bg-cream-dark text-left"
          >
            <Image
              src={photo.publicUrl}
              alt={photo.caption || `${activeAlbum.name}, foto ${index + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              unoptimized
            />
            {photo.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-deep/90 to-transparent px-4 pb-3 pt-10 text-[12px] font-semibold text-cream">
                {photo.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxPhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071126]/95 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${lightboxIndex + 1} de ${activeAlbum.photos.length}`}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            ×
          </button>

          {activeAlbum.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); moveLightbox(-1); }}
                className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/20 sm:left-5"
                aria-label="Foto anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); moveLightbox(1); }}
                className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/20 sm:right-5"
                aria-label="Foto siguiente"
              >
                ›
              </button>
            </>
          )}

          <figure className="flex max-h-full w-full max-w-6xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <Image
              src={lightboxPhoto.publicUrl}
              alt={lightboxPhoto.caption || `${activeAlbum.name}, foto ${lightboxIndex + 1}`}
              width={1600}
              height={1200}
              className="h-auto max-h-[78vh] w-auto max-w-full object-contain"
              unoptimized
            />
            <figcaption className="mt-4 text-center text-cream">
              {lightboxPhoto.caption && <div className="text-[14px] font-semibold">{lightboxPhoto.caption}</div>}
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-cream/60">
                {activeAlbum.name} · {lightboxIndex + 1} de {activeAlbum.photos.length}
              </div>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
