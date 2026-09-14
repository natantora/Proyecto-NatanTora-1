"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

export default function EventPriceEditor({ eventId, initialPrice, label, allowFree = true }: { eventId: string; initialPrice: number; label: string; allowFree?: boolean }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(initialPrice));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setError(null);
    try {
      const response = await fetch("/api/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eventId, action: "update_price", seat_price: price }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo guardar");
      setMessage("Precio actualizado para las nuevas reservaciones"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="rounded-xl border border-gold/30 bg-gold/10 p-4 sm:flex sm:items-end sm:justify-between sm:gap-5"><div><label className="text-xs font-bold uppercase tracking-[.14em] text-gold-deep">{label}<input className="input mt-2 max-w-[220px] bg-white normal-case" type="number" min={allowFree ? "0" : "0.01"} max="1000000" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} /></label><p className="mt-2 text-xs text-midrash-600">{allowFree ? "Usa 0 para un evento gratuito. " : "La entrada general debe tener un precio mayor a cero. "}El cambio aplica solamente a reservaciones nuevas; las sillas con precio especial conservan su valor.</p>{message ? <p className="mt-2 text-xs text-green-700">{message}</p> : null}{error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}</div><button disabled={busy} className="btn-primary mt-4 justify-center sm:mt-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar precio</button></form>;
}
