"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReservationActions({ eventId, userId, eventTitle, memberName }: { eventId: string; userId: string; eventTitle: string; memberName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm(`¿Cancelar todos los lugares de ${memberName} para “${eventTitle}”?\n\nLos asientos volverán a estar disponibles y la persona recibirá un correo.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, user_id: userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo cancelar");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cancelar");
    } finally {
      setBusy(false);
    }
  }

  return <div className="min-w-[120px] text-right"><button type="button" disabled={busy} onClick={cancel} className="rounded border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? "Cancelando…" : "Cancelar"}</button>{error ? <div className="mt-1 text-[10px] text-red-700">{error}</div> : null}</div>;
}
