"use client";

import { useMemo, useState } from "react";
import { Armchair, CheckCircle2, Loader2, Users } from "lucide-react";
import type { VenueTable } from "@/lib/venue-layout";
import { CANVAS_W, CANVAS_H } from "@/lib/venue-canvas";

type Seat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number };
type Reservation = { id: string; seat_id: string | null; row_label: string | null; seat_number: number | null; x: number | null } | null;

export default function EventReservationClient({ eventId, mode, capacity, seats: initialSeats, venueTables, existingReservation, reservedCount }: {
  eventId: string; mode: "none" | "open" | "assigned"; capacity: number | null; seats: Seat[]; venueTables: VenueTable[];
  existingReservation: Reservation; reservedCount: number;
}) {
  const [seats, setSeats] = useState(initialSeats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reservation, setReservation] = useState(existingReservation);
  const [count, setCount] = useState(reservedCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasMap = seats.length > 0 && seats.every((seat) => seat.x !== null && seat.y !== null);
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of seats) grouped.set(seat.row_label, [...(grouped.get(seat.row_label) ?? []), seat]);
    return [...grouped.entries()];
  }, [seats]);

  async function reserve() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/reserve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seatId: selectedId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReservation({ id: body.reservation.id, seat_id: body.seat?.id ?? null, row_label: body.seat?.row_label ?? null, seat_number: body.seat?.seat_number ?? null, x: body.seat?.x ?? null });
      setCount((current) => current + 1);
      if (body.seat) setSeats((current) => current.map((seat) => seat.id === body.seat.id ? { ...seat, status: "occupied" } : seat));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible reservar"); }
    finally { setLoading(false); }
  }

  if (mode === "none") return <div className="border border-line bg-cream-light p-6 text-sm text-ink-soft">Este evento no requiere reservar lugar.</div>;
  if (reservation) return (
    <div className="border border-gold/40 bg-gold/10 p-7 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-gold-deep" />
      <h2 className="mt-4 font-serif text-2xl font-bold text-navy">Tu lugar está reservado</h2>
      {reservation.row_label && reservation.x !== null ? <p className="mt-2 text-ink-soft">Asiento <strong>{reservation.row_label}</strong></p> : reservation.row_label && reservation.seat_number ? <p className="mt-2 text-ink-soft">Asiento <strong>{reservation.row_label}{reservation.seat_number}</strong></p> : <p className="mt-2 text-ink-soft">Tu acceso es de lugar libre; al llegar podrás ocupar el lugar disponible que prefieras.</p>}
    </div>
  );

  if (mode === "open") {
    const remaining = Math.max((capacity ?? 0) - count, 0);
    return <div className="border border-line bg-cream-light p-6 sm:p-8">
      <div className="flex items-start gap-4"><Users className="mt-1 h-7 w-7 shrink-0 text-gold-deep" /><div>
        <h2 className="font-serif text-2xl font-bold text-navy">Lugar libre</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Apartas tu entrada, pero no un asiento específico. Al llegar eliges entre los lugares disponibles.</p>
        <p className="mt-4 text-sm font-semibold text-navy">Quedan {remaining} de {capacity} lugares</p>
      </div></div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <button onClick={reserve} disabled={loading || remaining === 0} className="btn-primary mt-6 w-full justify-center sm:w-auto">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : remaining === 0 ? "Cupo completo" : "Reservar mi lugar"}</button>
    </div>;
  }

  const selected = seats.find((seat) => seat.id === selectedId);

  if (!hasMap) {
    return <div className="border border-line bg-cream-light p-4 sm:p-8">
      <div className="flex items-start gap-4"><Armchair className="mt-1 h-7 w-7 shrink-0 text-gold-deep" /><div><h2 className="font-serif text-2xl font-bold text-navy">Elige tu asiento</h2><p className="mt-2 text-sm text-ink-soft">Los lugares oscuros ya están ocupados. Selecciona uno disponible para reservarlo.</p></div></div>
      <div className="mx-auto my-8 max-w-2xl border border-gold/40 bg-navy py-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-gold-light">Frente / escenario</div>
      <div className="overflow-x-auto pb-3"><div className="mx-auto min-w-max space-y-3">
        {rows.map(([rowLabel, rowSeats]) => <div key={rowLabel} className="flex items-center gap-2"><span className="w-6 text-center text-xs font-bold text-ink-muted">{rowLabel}</span>{rowSeats.map((seat) => {
          const occupied = seat.status === "occupied"; const isSelected = selectedId === seat.id;
          return <button key={seat.id} type="button" disabled={occupied} onClick={() => setSelectedId(seat.id)} aria-label={`Asiento ${seat.row_label}${seat.seat_number}${occupied ? ", ocupado" : ""}`} className={`h-10 w-10 rounded-t-lg border text-xs font-bold transition-colors ${occupied ? "cursor-not-allowed border-navy bg-navy text-cream/45" : isSelected ? "border-gold-deep bg-gold text-navy" : "border-gold/50 bg-white text-navy hover:bg-gold/15"}`}>{seat.seat_number}</button>;
        })}</div>)}
      </div></div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <div className="mt-6 flex flex-col items-stretch justify-between gap-4 border-t border-line pt-5 sm:flex-row sm:items-center"><p className="text-sm text-ink-soft">{selected ? <>Seleccionaste <strong className="text-navy">{selected.row_label}{selected.seat_number}</strong></> : "Selecciona un lugar del plano"}</p><button onClick={reserve} disabled={loading || !selectedId} className="btn-primary justify-center">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar asiento"}</button></div>
    </div>;
  }

  return <div className="border border-line bg-cream-light p-4 sm:p-8">
    <div className="flex items-start gap-4"><Armchair className="mt-1 h-7 w-7 shrink-0 text-gold-deep" /><div><h2 className="font-serif text-2xl font-bold text-navy">Elige tu asiento</h2><p className="mt-2 text-sm text-ink-soft">Este es el plano real del salón. Los lugares oscuros ya están ocupados.</p></div></div>
    <div className="mx-auto my-6 overflow-auto rounded-lg border border-line bg-white p-2">
      <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full min-w-[700px]">
        {venueTables.map((t) => {
          if (t.kind === "wall") {
            return <rect key={t.id} x={t.x - t.width / 2} y={t.y - t.height / 2} width={t.width} height={t.height} transform={`rotate(${t.rotation} ${t.x} ${t.y})`} className="fill-navy" />;
          }
          if (t.kind === "rect") {
            return <rect key={t.id} x={t.x - t.width / 2} y={t.y - t.height / 2} width={t.width} height={t.height} rx={3} transform={`rotate(${t.rotation} ${t.x} ${t.y})`} className="fill-navy/10 stroke-navy/40" />;
          }
          return <circle key={t.id} cx={t.x} cy={t.y} r={t.width / 2} className="fill-navy/10 stroke-navy/40" />;
        })}
        {seats.map((seat) => {
          const occupied = seat.status === "occupied"; const isSelected = selectedId === seat.id;
          const cls = occupied ? "fill-navy stroke-navy" : isSelected ? "fill-gold stroke-gold-deep" : "fill-white stroke-navy hover:fill-gold/20";
          return <g key={seat.id} onClick={() => !occupied && setSelectedId(seat.id)} className={occupied ? "cursor-not-allowed" : "cursor-pointer"} aria-label={`Asiento ${seat.row_label}${occupied ? ", ocupado" : ""}`}>
            <g transform={`rotate(${seat.rotation} ${seat.x} ${seat.y})`}>
              <rect x={seat.x! - 9} y={seat.y! - 10} width={18} height={3.5} rx={1} className={cls} strokeWidth={isSelected ? 2 : 1.2} />
              <rect x={seat.x! - 8} y={seat.y! - 7} width={16} height={16} rx={2.5} className={cls} strokeWidth={isSelected ? 2 : 1.2} />
            </g>
            <text x={seat.x!} y={seat.y! + 1} textAnchor="middle" dominantBaseline="middle" className={`pointer-events-none select-none text-[8px] font-bold ${occupied ? "fill-cream/60" : "fill-navy"}`}>{seat.row_label}</text>
          </g>;
        })}
      </svg>
    </div>
    {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    <div className="mt-6 flex flex-col items-stretch justify-between gap-4 border-t border-line pt-5 sm:flex-row sm:items-center"><p className="text-sm text-ink-soft">{selected ? <>Seleccionaste <strong className="text-navy">{selected.row_label}</strong></> : "Selecciona un lugar del plano"}</p><button onClick={reserve} disabled={loading || !selectedId} className="btn-primary justify-center">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar asiento"}</button></div>
  </div>;
}
