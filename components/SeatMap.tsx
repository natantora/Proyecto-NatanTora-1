"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SEAT_TIERS, type SeatTier } from "@/lib/constants";
import { formatMXN, cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

export type Seat = { id: string; row_label: string; seat_number: number; tier: SeatTier; status: "available" | "reserved" | "taken"; };

type Props = { seats: Seat[] };

const ROW_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export default function SeatMap({ seats: initialSeats }: Props) {
  const [seats, setSeats] = useState(initialSeats);
  const [selected, setSelected] = useState<Seat | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const stats = useMemo(() => {
    const available = seats.filter((s) => s.status === "available").length;
    const reserved = seats.filter((s) => s.status !== "available").length;
    return { available, reserved, total: seats.length };
  }, [seats]);

  const rows = useMemo(() => {
    const map: Record<string, Seat[]> = {};
    for (const s of seats) { (map[s.row_label] ??= []).push(s); }
    for (const row of Object.keys(map)) { map[row].sort((a, b) => a.seat_number - b.seat_number); }
    return map;
  }, [seats]);

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seats/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatId: selected.id, holder_name: form.name, holder_email: form.email, holder_phone: form.phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error desconocido");
      setSeats((prev) => prev.map((s) => s.id === selected.id ? { ...s, status: "reserved" } : s));
      setMessage({ type: "success", text: `¡Asiento ${selected.row_label}${selected.seat_number} reservado! Te contactaremos para confirmar el pago.` });
      setSelected(null);
      setForm({ name: "", email: "", phone: "" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error al reservar" });
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 rounded-xl border border-midrash-100 bg-white p-4">
        {(Object.keys(SEAT_TIERS) as SeatTier[]).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className={cn("inline-block h-5 w-5 rounded-md border border-midrash-300", SEAT_TIERS[k].color)} />
            <span className="text-sm font-medium text-midrash-800">{SEAT_TIERS[k].name} — {formatMXN(SEAT_TIERS[k].price)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded-md border border-midrash-300 bg-midrash-900" />
          <span className="text-sm font-medium text-midrash-800">Reservado</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-50 p-3 text-center"><div className="font-serif text-2xl font-bold text-green-700">{stats.available}</div><div className="text-xs text-green-600">Disponibles</div></div>
        <div className="rounded-lg bg-midrash-50 p-3 text-center"><div className="font-serif text-2xl font-bold text-midrash-900">{stats.reserved}</div><div className="text-xs text-midrash-600">Reservados</div></div>
        <div className="rounded-lg bg-gold-50 p-3 text-center"><div className="font-serif text-2xl font-bold text-gold-700">{stats.total}</div><div className="text-xs text-gold-600">Total</div></div>
      </div>
      {message && (<div className={cn("rounded-lg p-4 text-sm", message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{message.text}</div>)}
      <div className="flex items-center justify-center gap-8 py-4">
        <div className="rounded-lg border-2 border-gold-400 bg-gold-50 px-6 py-3 text-center"><span className="text-xs font-semibold uppercase tracking-wider text-gold-700">Arón HaKódesh</span></div>
        <div className="rounded-lg border-2 border-midrash-400 bg-midrash-50 px-6 py-3 text-center"><span className="text-xs font-semibold uppercase tracking-wider text-midrash-800">Tebá</span></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-midrash-100 bg-gradient-to-b from-midrash-50 to-white p-6">
        <div className="mx-auto inline-block min-w-full space-y-2">
          {ROW_ORDER.map((row) => {
            const rowSeats = rows[row] ?? [];
            if (rowSeats.length === 0) return null;
            return (
              <div key={row} className="flex items-center gap-1">
                <span className="w-6 flex-shrink-0 text-center font-serif text-sm font-bold text-midrash-700">{row}</span>
                <div className="flex flex-wrap gap-1">
                  {rowSeats.map((seat) => {
                    const isAvailable = seat.status === "available";
                    const tier = SEAT_TIERS[seat.tier];
                    return (
                      <button key={seat.id} type="button" disabled={!isAvailable} onClick={() => isAvailable && setSelected(seat)} title={`${seat.row_label}${seat.seat_number} — ${tier.name} (${formatMXN(tier.price)})`} className={cn("flex h-7 w-7 items-center justify-center rounded border text-[10px] font-semibold transition-all", isAvailable ? cn(tier.color, "border-midrash-300 text-midrash-900 hover:ring-2 hover:ring-gold-400") : "bg-midrash-900 text-white border-midrash-900 cursor-not-allowed opacity-70", selected?.id === seat.id && "ring-2 ring-gold-500")}>{seat.seat_number}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif text-xl font-semibold text-midrash-900">Reservar asiento {selected.row_label}{selected.seat_number}</h3>
                <p className="text-sm text-midrash-600">{SEAT_TIERS[selected.tier].name} — {formatMXN(SEAT_TIERS[selected.tier].price)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-1 text-midrash-400 hover:bg-midrash-50 hover:text-midrash-900"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleReserve} className="mt-6 space-y-3">
              <div><label className="block text-sm font-medium text-midrash-700">Nombre completo</label><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input mt-1" /></div>
              <div><label className="block text-sm font-medium text-midrash-700">Correo electrónico</label><input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input mt-1" /></div>
              <div><label className="block text-sm font-medium text-midrash-700">Teléfono</label><input required type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input mt-1" /></div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="mr-2 h-4 w-4" /> Reservar este asiento</>)}</button>
              <p className="text-center text-xs text-midrash-500">Al reservar, un administrador te contactará para confirmar el pago.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
