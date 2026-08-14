"use client";

import { useState } from "react";
import { SEAT_TIERS, type SeatTier } from "@/lib/constants";
import { formatMXN, cn } from "@/lib/utils";
import { Check, RotateCcw, Loader2 } from "lucide-react";

type SeatRow = { id: string; row_label: string; seat_number: number; tier: SeatTier; status: "available" | "reserved" | "taken"; holder_name: string | null; holder_email: string | null; holder_phone: string | null; reserved_at: string | null; };

export default function SeatsAdmin({ seats }: { seats: SeatRow[] }) {
  const [list, setList] = useState(seats);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "reserved" | "taken" | "available">("reserved");
  const stats = { available: list.filter((s) => s.status === "available").length, reserved: list.filter((s) => s.status === "reserved").length, taken: list.filter((s) => s.status === "taken").length };

  async function update(id: string, status: "available" | "taken") {
    setLoadingId(id);
    try {
      const res = await fetch("/api/seats", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error();
      setList((prev) => prev.map((s) => s.id === id ? (status === "available" ? { ...s, status, holder_name: null, holder_email: null, holder_phone: null, reserved_at: null } : { ...s, status }) : s));
    } catch { alert("Error actualizando asiento"); }
    finally { setLoadingId(null); }
  }

  const filtered = list.filter((s) => filter === "all" ? true : s.status === filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-50 p-4 text-center"><div className="font-serif text-2xl font-bold text-green-700">{stats.available}</div><div className="text-xs text-green-600">Disponibles</div></div>
        <div className="rounded-lg bg-yellow-50 p-4 text-center"><div className="font-serif text-2xl font-bold text-yellow-700">{stats.reserved}</div><div className="text-xs text-yellow-600">Reservados</div></div>
        <div className="rounded-lg bg-midrash-100 p-4 text-center"><div className="font-serif text-2xl font-bold text-midrash-800">{stats.taken}</div><div className="text-xs text-midrash-600">Confirmados</div></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["reserved", "taken", "available", "all"] as const).map((f) => (<button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-sm font-medium", filter === f ? "bg-midrash-800 text-white" : "bg-midrash-50 text-midrash-700 hover:bg-midrash-100")}>{f === "all" ? "Todos" : f === "reserved" ? "Pendientes" : f === "taken" ? "Confirmados" : "Libres"}</button>))}
      </div>
      <div className="overflow-hidden rounded-xl border border-midrash-100 bg-white">
        <table className="min-w-full divide-y divide-midrash-100">
          <thead className="bg-midrash-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Asiento</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Tier</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Holder</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Estado</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Acciones</th></tr></thead>
          <tbody className="divide-y divide-midrash-100">
            {filtered.slice(0, 100).map((s) => { const isLoading = loadingId === s.id; return (
              <tr key={s.id}>
                <td className="px-4 py-3 font-serif text-sm font-bold">{s.row_label}{s.seat_number}</td>
                <td className="px-4 py-3 text-sm"><span className="font-medium">{SEAT_TIERS[s.tier].name}</span><span className="ml-2 text-xs text-midrash-500">{formatMXN(SEAT_TIERS[s.tier].price)}</span></td>
                <td className="px-4 py-3 text-sm">{s.holder_name ? (<><div className="font-medium text-midrash-900">{s.holder_name}</div><div className="text-xs text-midrash-500">{s.holder_email}</div>{s.holder_phone && (<div className="text-xs text-midrash-500">{s.holder_phone}</div>)}</>) : (<span className="text-xs text-midrash-400">—</span>)}</td>
                <td className="px-4 py-3 text-sm"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", s.status === "available" ? "bg-green-100 text-green-800" : s.status === "reserved" ? "bg-yellow-100 text-yellow-800" : "bg-midrash-200 text-midrash-800")}>{s.status}</span></td>
                <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{s.status === "reserved" && (<button disabled={isLoading} onClick={() => update(s.id, "taken")} className="rounded-lg bg-midrash-800 px-3 py-1 text-xs font-semibold text-white hover:bg-midrash-900 disabled:opacity-50">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="mr-1 inline h-3 w-3" />Confirmar</>}</button>)}{s.status !== "available" && (<button disabled={isLoading} onClick={() => update(s.id, "available")} className="rounded-lg border border-midrash-200 px-3 py-1 text-xs font-semibold text-midrash-700 hover:bg-midrash-50 disabled:opacity-50"><RotateCcw className="mr-1 inline h-3 w-3" />Liberar</button>)}</div></td>
              </tr>
            ); })}
          </tbody>
        </table>
        {filtered.length > 100 && (<p className="bg-midrash-50 p-3 text-center text-xs text-midrash-600">Mostrando 100 de {filtered.length}.</p>)}
      </div>
    </div>
  );
}
