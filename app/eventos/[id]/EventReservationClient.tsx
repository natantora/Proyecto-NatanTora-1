"use client";

import { useMemo, useState } from "react";
import { Armchair, CheckCircle2, Loader2, Users } from "lucide-react";
import type { VenueTable } from "@/lib/venue-layout";
import InteractiveSeatPlan, { type SeatPlanType } from "@/components/InteractiveSeatPlan";

type Seat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number };
type Reservation = { id: string; seat_id: string | null; row_label: string | null; seat_number: number | null; x: number | null };

export default function EventReservationClient({ eventId, mode, planType, capacity, seatPrice, reservationsOpen, seats: initialSeats, venueTables, existingReservations, reservedCount }: {
  eventId: string; mode: "none" | "open" | "assigned"; planType: SeatPlanType; capacity: number | null; seats: Seat[]; venueTables: VenueTable[];
  seatPrice: number; reservationsOpen: boolean; existingReservations: Reservation[]; reservedCount: number;
}) {
  const [seats, setSeats] = useState(initialSeats);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reservations, setReservations] = useState(existingReservations);
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
      const response = await fetch(`/api/events/${eventId}/reserve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "assigned" ? { seatIds: selectedIds } : {}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const reservedSeats: Seat[] = body.seats ?? (body.seat ? [body.seat] : []);
      const newReservations: Reservation[] = (body.reservations ?? (body.reservation ? [body.reservation] : [])).map((item: Reservation, index: number) => ({
        ...item,
        row_label: reservedSeats[index]?.row_label ?? null,
        seat_number: reservedSeats[index]?.seat_number ?? null,
        x: reservedSeats[index]?.x ?? null,
      }));
      setReservations(newReservations);
      setCount((current) => current + Math.max(newReservations.length, 1));
      if (reservedSeats.length) {
        const reservedIds = new Set(reservedSeats.map((seat) => seat.id));
        setSeats((current) => current.map((seat) => reservedIds.has(seat.id) ? { ...seat, status: "occupied" } : seat));
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible reservar"); }
    finally { setLoading(false); }
  }

  if (mode === "none") return <div className="border border-line bg-cream-light p-6 text-sm text-ink-soft">Este evento no requiere reservar lugar.</div>;
  if (reservations.length > 0) return (
    <div className="border border-gold/40 bg-gold/10 p-7 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-gold-deep" />
      <h2 className="mt-4 font-serif text-2xl font-bold text-navy">{reservations.length > 1 ? "Tus lugares están reservados" : "Tu lugar está reservado"}</h2>
      {mode === "assigned" ? (
        <><p className="mt-2 text-ink-soft">Asientos <strong>{reservations.map((item) => item.x !== null ? item.row_label : `${item.row_label ?? ""}${item.seat_number ?? ""}`).join(", ")}</strong></p>{seatPrice > 0 ? <p className="mt-2 text-sm font-semibold text-navy">Total: ${(seatPrice * reservations.length).toLocaleString("es-MX")} MXN</p> : null}</>
      ) : <p className="mt-2 text-ink-soft">Tu acceso es de lugar libre; al llegar podrás ocupar el lugar disponible que prefieras.</p>}
    </div>
  );

  if (!reservationsOpen) return (
    <div className="border border-gold/35 bg-gold/10 p-7 text-center">
      <h2 className="font-serif text-2xl font-bold text-navy">Reservaciones cerradas</h2>
      <p className="mt-2 text-sm text-ink-soft">El evento ya está publicado, pero el administrador todavía no ha abierto la selección de lugares.</p>
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

  const selected = seats.filter((seat) => selectedIds.includes(seat.id));
  const toggleSeat = (seatId: string) => setSelectedIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  const selectedNames = selected.map((seat) => seat.x !== null ? seat.row_label : `${seat.row_label}${seat.seat_number}`);
  const compactNames = selectedNames.length > 4 ? `${selectedNames.slice(0, 4).join(", ")} y ${selectedNames.length - 4} más` : selectedNames.join(", ");
  const confirmText = loading ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedIds.length > 1 ? `Confirmar ${selectedIds.length} asientos` : "Confirmar asiento";
  const reservationControls = (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-gold/30 bg-cream-light/95 px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(10,29,54,.16)] backdrop-blur sm:static sm:mt-6 sm:flex sm:justify-between sm:border-line sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:shadow-none" aria-live="polite">
      <p className="min-w-0 text-sm text-ink-soft">
        {selected.length > 0 ? <><strong className="block text-navy sm:inline">{selected.length} {selected.length === 1 ? "asiento" : "asientos"}</strong><span className="block truncate sm:ml-1 sm:inline">{compactNames}{seatPrice > 0 ? ` · $${(seatPrice * selected.length).toLocaleString("es-MX")} MXN` : ""}</span></> : "Selecciona uno o varios lugares"}
      </p>
      <button onClick={reserve} disabled={loading || selectedIds.length === 0} className="btn-primary min-h-11 shrink-0 justify-center px-4">{confirmText}</button>
    </div>
  );

  if (!hasMap) {
    return <div className="border border-line bg-cream-light p-3 pb-28 sm:p-8">
      <div className="flex items-start gap-4"><Armchair className="mt-1 h-7 w-7 shrink-0 text-gold-deep" /><div><h2 className="font-serif text-2xl font-bold text-navy">Elige tus asientos</h2><p className="mt-2 text-sm text-ink-soft">Los lugares oscuros ya están ocupados. Selecciona todos los asientos que quieras reservar.</p></div></div>
      <div className="mx-auto my-8 max-w-2xl border border-gold/40 bg-navy py-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-gold-light">Frente / escenario</div>
      <div className="overflow-x-auto pb-3"><div className="mx-auto min-w-max space-y-3">
        {rows.map(([rowLabel, rowSeats]) => <div key={rowLabel} className="flex items-center gap-2"><span className="w-6 text-center text-xs font-bold text-ink-muted">{rowLabel}</span>{rowSeats.map((seat) => {
          const occupied = seat.status === "occupied"; const isSelected = selectedIds.includes(seat.id);
          return <button key={seat.id} type="button" disabled={occupied} onClick={() => toggleSeat(seat.id)} aria-pressed={isSelected} aria-label={`Asiento ${seat.row_label}${seat.seat_number}${occupied ? ", ocupado" : isSelected ? ", seleccionado" : ", disponible"}`} className={`h-10 w-10 rounded-t-lg border text-xs font-bold transition-colors ${occupied ? "cursor-not-allowed border-navy bg-navy text-cream/45" : isSelected ? "border-gold-deep bg-gold text-navy" : "border-gold/50 bg-white text-navy hover:bg-gold/15"}`}>{seat.seat_number}</button>;
        })}</div>)}
      </div></div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {reservationControls}
    </div>;
  }

  return <div className="border border-line bg-cream-light p-3 pb-28 sm:p-8">
    <div className="flex items-start gap-4"><Armchair className="mt-1 h-7 w-7 shrink-0 text-gold-deep" /><div><h2 className="font-serif text-2xl font-bold text-navy">Elige tus asientos</h2><p className="mt-2 text-sm text-ink-soft">{planType === "architectural" ? "Toca directamente todas las sillas que quieres en el plano original. Vuelve a tocar una silla para quitarla de tu selección." : "Selecciona uno o varios lugares en el plano preparado para este evento."}</p></div></div>
    <div className="my-4 sm:my-6">
      <InteractiveSeatPlan
        seats={seats}
        venueTables={venueTables}
        selectedSeatId={null}
        selectedSeatIds={selectedIds}
        onSelect={toggleSeat}
        planType={planType}
      />
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted sm:text-xs"><span><strong className="text-gold-deep">Dorado</strong> seleccionado</span><span><strong className="text-red-800">Rojo</strong> ocupado</span></div>
    {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    {reservationControls}
  </div>;
}
