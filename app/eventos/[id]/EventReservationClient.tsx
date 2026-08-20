"use client";

import { useMemo, useState } from "react";
import { Armchair, CheckCircle2, Loader2, Users } from "lucide-react";

type Seat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied" };
type Reservation = { id: string; seat_id: string | null; row_label: string | null; seat_number: number | null } | null;

export default function EventReservationClient({ eventId, mode, capacity, seats: initialSeats, existingReservation, reservedCount }: {
  eventId: string; mode: "none" | "open" | "assigned"; capacity: number | null; seats: Seat[];
  existingReservation: Reservation; reservedCount: number;
}) {
  const [seats, setSeats] = useState(initialSeats);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reservation, setReservation] = useState(existingReservation);
  const [count, setCount] = useState(reservedCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      setReservation({ id: body.reservation.id, seat_id: body.seat?.id ?? null, row_label: body.seat?.row_label ?? null, seat_number: body.seat?.seat_number ?? null });
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
      {reservation.row_label && reservation.seat_number ? <p className="mt-2 text-ink-soft">Asiento <strong>{reservation.row_label}{reservation.seat_number}</strong></p> : <p className="mt-2 text-ink-soft">Tu acceso es de lugar libre; al llegar podrás ocupar el lugar disponible que prefieras.</p>}
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
