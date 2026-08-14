"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GallerySetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSetup() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/setup-gallery", { method: "POST" });
      const j = await res.json();
      if (!res.ok && !j.ok) {
        throw new Error(j.error || "Error desconocido");
      }
      setMsg(j.alreadyExists ? "El bucket ya existía. Listo." : "Bucket creado. Listo para subir fotos.");
      setTimeout(() => router.refresh(), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gold/30 bg-gold/5 p-8 lg:p-10 space-y-6">
      <div>
        <div className="text-[10px] tracking-[0.22em] uppercase font-bold text-gold-deep mb-2">
          Configuración inicial
        </div>
        <h2 className="serif-display text-navy text-[24px] lg:text-[28px] mb-3">
          Falta inicializar el almacenamiento
        </h2>
        <p className="text-[14px] text-ink-soft leading-relaxed max-w-2xl">
          Antes de subir la primera foto, hay que crear el bucket de
          almacenamiento en Supabase. Es un setup de una sola vez, automatizado.
          Tap el botón abajo y listo.
        </p>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 px-4 py-3 text-[14px] text-green-800">
          ✓ {msg}
        </div>
      )}
      {err && (
        <div className="bg-red-50 border border-red-200 px-4 py-3 text-[14px] text-red-800">
          {err}
        </div>
      )}

      <button
        onClick={handleSetup}
        disabled={loading}
        className="bg-navy-deep text-cream px-6 py-3 text-[12px] font-bold tracking-[0.18em] uppercase hover:bg-navy transition-colors duration-base ease-out-quart disabled:opacity-50"
      >
        {loading ? "Configurando…" : "Inicializar almacenamiento de fotos"}
      </button>
    </div>
  );
}
