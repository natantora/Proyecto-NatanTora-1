"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  media_type: string | null;
  media_url: string | null;
  rabbi: string | null;
  duration_minutes: number | null;
  owner_id: string | null;
  created_at: string;
};

export default function PendingReviewList({
  items,
  owners,
}: {
  items: Item[];
  owners: Record<string, { name: string; email: string }>;
}) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function approve(id: string) {
    setLoadingId(id); setMsg(null);
    try {
      const res = await fetch(`/api/admin/classes/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Error");
      setList(list.filter((x) => x.id !== id));
      setMsg("Clase aprobada y publicada.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      setMsg("Escribe una razón para devolver la clase al rabino.");
      return;
    }
    setLoadingId(id); setMsg(null);
    try {
      const res = await fetch(`/api/admin/classes/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: reason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Error");
      setList(list.filter((x) => x.id !== id));
      setMsg("Clase devuelta al rabino con tus comentarios.");
      setRejectingId(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingId(null);
    }
  }

  if (list.length === 0) {
    return (
      <div className="bg-cream-light border border-line p-12 text-center">
        <p className="text-[15px] text-ink-soft">Sin clases pendientes. Todo al día.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="bg-cream-dark border border-line px-4 py-3 text-[14px] text-navy">
          {msg}
        </div>
      )}
      {list.map((c) => {
        const owner = c.owner_id ? owners[c.owner_id] : null;
        const isLoading = loadingId === c.id;
        const isRejecting = rejectingId === c.id;
        return (
          <article key={c.id} className="bg-cream-light border border-line p-5 lg:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 ${
                    c.media_type === 'audio' ? 'bg-gold text-navy-deep' :
                    c.media_type === 'video' ? 'bg-navy text-cream' :
                    'bg-ink text-cream'
                  }`}>
                    {c.media_type ?? 'texto'}
                  </span>
                  {c.category && <span className="text-[10px] text-ink-muted uppercase tracking-wider">{c.category}</span>}
                  <span className="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-300 uppercase tracking-wider font-bold px-1.5 py-0.5">
                    En revisión
                  </span>
                </div>
                <h3 className="text-[17px] font-bold text-navy">{c.title}</h3>
                {c.rabbi && <div className="text-[12px] text-gold font-bold uppercase tracking-widest mt-1">{c.rabbi}</div>}
                {owner && (
                  <div className="text-[12px] text-ink-soft mt-2">
                    Subida por <strong>{owner.name}</strong>
                    {owner.email && <span className="text-ink-muted"> · {owner.email}</span>}
                  </div>
                )}
                <div className="text-[11px] text-ink-muted mt-1">
                  {new Date(c.created_at).toLocaleString("es-MX", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
            </div>

            {c.description && (
              <p className="text-[14px] text-ink leading-relaxed">{c.description}</p>
            )}

            {c.media_url && (
              <a href={c.media_url} target="_blank" rel="noopener noreferrer"
                className="inline-block text-[12px] tracking-[0.18em] uppercase font-bold text-navy hover:text-gold underline">
                Abrir contenido →
              </a>
            )}

            {!isRejecting ? (
              <div className="flex gap-2 pt-2">
                <button
                  disabled={isLoading}
                  onClick={() => approve(c.id)}
                  className="bg-navy text-cream px-5 py-2 text-[11px] tracking-[0.22em] uppercase font-bold hover:bg-navy-deep transition-colors disabled:opacity-50"
                >
                  Aprobar y publicar
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => { setRejectingId(c.id); setMsg(null); setReason(""); }}
                  className="border border-line text-ink-soft px-5 py-2 text-[11px] tracking-[0.22em] uppercase font-bold hover:border-rose-400 hover:text-rose-700 transition-colors disabled:opacity-50"
                >
                  Devolver con comentario
                </button>
              </div>
            ) : (
              <div className="space-y-2 border-t border-line pt-3">
                <label className="text-[11px] tracking-[0.22em] uppercase font-bold text-ink-soft">
                  Comentario al rabino
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Ej: la grabación tiene mucho ruido, ¿podrías volver a subirla?"
                  className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white resize-y"
                />
                <div className="flex gap-2">
                  <button
                    disabled={isLoading}
                    onClick={() => reject(c.id)}
                    className="bg-rose-700 text-cream px-5 py-2 text-[11px] tracking-[0.22em] uppercase font-bold hover:bg-rose-800 disabled:opacity-50"
                  >
                    Devolver
                  </button>
                  <button
                    disabled={isLoading}
                    onClick={() => { setRejectingId(null); setReason(""); }}
                    className="text-ink-soft px-5 py-2 text-[11px] tracking-[0.22em] uppercase font-bold hover:text-navy"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
