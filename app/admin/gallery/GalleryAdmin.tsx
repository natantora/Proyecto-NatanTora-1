"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ALL_CATEGORIES, CATEGORY_LABEL, type Photo, type Category } from "@/lib/gallery";

export default function GalleryAdmin({ initialPhotos }: { initialPhotos: Photo[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [category, setCategory] = useState<Category>("general");
  const [album, setAlbum] = useState(() => initialPhotos[0]?.album || "General");
  const [newAlbum, setNewAlbum] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [albumFilter, setAlbumFilter] = useState<string>("all");

  const albums = Array.from(new Set(photos.map((photo) => photo.album))).sort((a, b) => a.localeCompare(b, "es"));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const total = files.length;
    let success = 0;
    const newPhotos: Photo[] = [];
    const selectedAlbum = newAlbum.trim() || album || "General";

    for (let i = 0; i < total; i++) {
      const file = files[i];
      setProgress(`Subiendo ${i + 1} de ${total}: ${file.name}`);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", category);
        fd.append("album", selectedAlbum);
        if (caption.trim()) fd.append("caption", caption.trim());

        const res = await fetch("/api/gallery", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error || "Error");
        }
        newPhotos.push({
          path: j.path,
          publicUrl: j.publicUrl,
          category: j.category,
          album: j.album,
          timestamp: j.timestamp,
          caption: j.caption,
          uploadedBy: null,
          createdAt: new Date(j.timestamp).toISOString(),
        });
        success++;
      } catch (e) {
        setError(`Error en ${file.name}: ${e instanceof Error ? e.message : "?"}`);
      }
    }

    setPhotos((prev) => [...newPhotos, ...prev].sort((a, b) => b.timestamp - a.timestamp));
    setProgress(`${success} de ${total} subidas`);
    setUploading(false);
    setCaption("");
    setAlbum(selectedAlbum);
    setNewAlbum("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setProgress(null), 4000);
    router.refresh();
  }

  async function handleDelete(p: Photo) {
    if (!confirm(`¿Borrar esta foto? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/gallery?path=${encodeURIComponent(p.path)}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Error");
      setPhotos((prev) => prev.filter((x) => x.path !== p.path));
    } catch (e) {
      setError(`Error al borrar: ${e instanceof Error ? e.message : "?"}`);
    }
  }

  const filtered = photos.filter((photo) =>
    (filter === "all" || photo.category === filter) &&
    (albumFilter === "all" || photo.album === albumFilter),
  );

  return (
    <div className="space-y-8">
      {/* Form de subida */}
      <div className="border border-line bg-cream-light p-6 space-y-4">
        <div className="text-[10px] tracking-[0.22em] uppercase font-bold text-gold-deep">
          Subir fotos nuevas
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] text-ink-muted uppercase tracking-widest font-bold mb-1 block">
              Categoría
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={uploading}
              className="w-full border border-line px-3 py-2.5 text-[14px] focus:outline-none focus:border-gold bg-white"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] text-ink-muted uppercase tracking-widest font-bold mb-1 block">
              Álbum / carpeta
            </span>
            <select
              value={album}
              onChange={(e) => { setAlbum(e.target.value); setNewAlbum(""); }}
              disabled={uploading}
              className="w-full border border-line px-3 py-2.5 text-[14px] focus:outline-none focus:border-gold bg-white"
            >
              {albums.length === 0 && <option value="General">General</option>}
              {albums.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] text-ink-muted uppercase tracking-widest font-bold mb-1 block">
              Crear álbum nuevo (opcional)
            </span>
            <input
              type="text"
              value={newAlbum}
              onChange={(e) => setNewAlbum(e.target.value)}
              disabled={uploading}
              maxLength={80}
              placeholder="Ej: Rosh Hashaná 2026"
              className="w-full border border-line px-3 py-2.5 text-[14px] focus:outline-none focus:border-gold bg-white"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-ink-muted uppercase tracking-widest font-bold mb-1 block">
              Descripción (opcional)
            </span>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploading}
              maxLength={200}
              placeholder="Ej: Séder comunitario 2025"
              className="w-full border border-line px-3 py-2.5 text-[14px] focus:outline-none focus:border-gold bg-white"
            />
          </label>
        </div>

        <label
          className={
            "block border-2 border-dashed p-8 lg:p-10 text-center cursor-pointer transition-colors duration-base ease-out-quart " +
            (uploading
              ? "border-line bg-cream-dark cursor-wait"
              : "border-gold/40 hover:border-gold hover:bg-cream")
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={handleFileChange}
            className="sr-only"
          />
          <div className="text-[14px] font-bold text-navy mb-2">
            {uploading ? "Subiendo…" : "Tap para elegir fotos"}
          </div>
          <div className="text-[12px] text-ink-soft">
            Desde tu rollo del iPhone · JPEG/PNG/HEIC · máx 25MB cada una
          </div>
        </label>

        {progress && (
          <div className="bg-cream-dark border border-gold/30 px-4 py-2.5 text-[13px] text-navy">
            {progress}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-800">
            {error}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={
            "text-[11px] tracking-[0.22em] uppercase font-semibold px-4 py-2 border transition-colors duration-base ease-out-quart " +
            (filter === "all"
              ? "bg-navy text-cream border-navy"
              : "bg-cream-light text-ink-soft border-line hover:border-gold hover:text-navy")
          }
        >
          Todas ({photos.length})
        </button>
        {ALL_CATEGORIES.map((c) => {
          const count = photos.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={
                "text-[11px] tracking-[0.22em] uppercase font-semibold px-4 py-2 border transition-colors duration-base ease-out-quart " +
                (filter === c
                  ? "bg-navy text-cream border-navy"
                  : "bg-cream-light text-ink-soft border-line hover:border-gold hover:text-navy")
              }
            >
              {CATEGORY_LABEL[c]} ({count})
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Álbumes</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAlbumFilter("all")}
            className={`border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${albumFilter === "all" ? "border-gold bg-gold text-navy-deep" : "border-line bg-cream-light text-ink-soft hover:border-gold"}`}
          >
            Todos
          </button>
          {albums.map((name) => (
            <button
              key={name}
              onClick={() => setAlbumFilter(name)}
              className={`border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${albumFilter === name ? "border-gold bg-gold text-navy-deep" : "border-line bg-cream-light text-ink-soft hover:border-gold"}`}
            >
              {name} ({photos.filter((photo) => photo.album === name).length})
            </button>
          ))}
        </div>
      </div>

      {/* Grid de fotos */}
      {filtered.length === 0 ? (
        <div className="border border-line bg-cream-light p-12 text-center">
          <p className="text-[15px] text-ink-soft italic">
            No hay fotos con estos filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {filtered.map((p) => (
            <div key={p.path} className="relative aspect-square bg-cream-dark border border-line group overflow-hidden">
              <Image
                src={p.publicUrl}
                alt={p.caption || "Foto"}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-navy-deep/85 pointer-events-none" />
              <div className="absolute bottom-2 left-2 right-2 text-cream z-10">
                <div className="text-[9px] tracking-[0.2em] uppercase text-gold-light">
                  {p.album} · {CATEGORY_LABEL[p.category]}
                </div>
                {p.caption && (
                  <div className="text-[11px] font-semibold leading-tight mt-0.5 line-clamp-2">
                    {p.caption}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(p)}
                className="absolute top-2 right-2 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-base ease-out-quart"
              >
                Borrar
              </button>
              {/* En móvil, botón siempre visible */}
              <button
                onClick={() => handleDelete(p)}
                className="lg:hidden absolute top-2 right-2 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1"
                aria-label="Borrar foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
