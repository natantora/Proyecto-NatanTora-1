"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Armchair, CheckCircle2, Loader2, Users } from "lucide-react";
import type { VenueTable } from "@/lib/venue-layout";
import InteractiveSeatPlan, { type SeatPlanType } from "@/components/InteractiveSeatPlan";

type Seat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number; price: string | number | null };
type Reservation = { id: string; seat_id: string | null; row_label: string | null; seat_number: number | null; x: number | null; unit_price: string | number };
type PendingPayment = { id: string; expires_at: string; seats: string[] };

export default function EventReservationClient({ eventId, mode, planType, capacity, seatPrice, reservationsOpen, seats: initialSeats, venueTables, existingReservations, pendingPayment: initialPendingPayment, reservedCount, paymentResult, sessionId, internalPaymentId, providerPaymentId, cancelledPaymentId }: {
  eventId: string; mode: "none" | "open" | "assigned"; planType: SeatPlanType; capacity: number | null; seats: Seat[]; venueTables: VenueTable[];
  seatPrice: number; reservationsOpen: boolean; existingReservations: Reservation[]; pendingPayment: PendingPayment | null; reservedCount: number;
  paymentResult: "success" | "cancelled" | null; sessionId: string | null; internalPaymentId: string | null; providerPaymentId: string | null; cancelledPaymentId: string | null;
}) {
  const router = useRouter();
  const [seats, setSeats] = useState(initialSeats);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reservations, setReservations] = useState(existingReservations);
  const [count, setCount] = useState(reservedCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingPayment, setPendingPayment] = useState(initialPendingPayment);
  const [cancellingPending, setCancellingPending] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const selectedTotal = mode === "assigned"
    ? seats.filter((seat) => selectedIds.includes(seat.id)).reduce((sum, seat) => sum + Number(seat.price ?? seatPrice), 0)
    : seatPrice;
  const paymentRequired = selectedTotal > 0;
  const hasMap = seats.length > 0 && seats.every((seat) => seat.x !== null && seat.y !== null);
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of seats) grouped.set(seat.row_label, [...(grouped.get(seat.row_label) ?? []), seat]);
    return [...grouped.entries()];
  }, [seats]);

  useEffect(() => {
    if (paymentResult === "cancelled" && cancelledPaymentId) {
      void fetch(`/api/events/${eventId}/reserve`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_id: cancelledPaymentId }) })
        .finally(() => { router.replace(`/eventos/${eventId}`); router.refresh(); });
      return;
    }
    if (paymentResult !== "success" || (!sessionId && !internalPaymentId)) return;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const params = new URLSearchParams();
      if (sessionId) params.set("session_id", sessionId);
      if (internalPaymentId) params.set("internal_payment_id", internalPaymentId);
      if (providerPaymentId) params.set("provider_payment_id", providerPaymentId);
      const response = await fetch(`/api/payments/status?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (payload.status === "paid") { router.replace(`/eventos/${eventId}`); router.refresh(); }
      else if (attempts < 7) window.setTimeout(check, 1200);
    };
    void check();
  }, [cancelledPaymentId, eventId, internalPaymentId, paymentResult, providerPaymentId, router, sessionId]);

  useEffect(() => {
    const refreshAfterCheckout = (event: PageTransitionEvent) => { if (event.persisted) router.refresh(); };
    window.addEventListener("pageshow", refreshAfterCheckout);
    return () => window.removeEventListener("pageshow", refreshAfterCheckout);
  }, [router]);

  async function releasePendingPayment() {
    if (!pendingPayment) return;
    setCancellingPending(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/reserve`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_id: pendingPayment.id }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No fue posible liberar los asientos");
      setPendingPayment(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible liberar los asientos");
    } finally {
      setCancellingPending(false);
    }
  }

  async function reserve() {
    if (paymentRequired && !policyAccepted) { setError("Confirma la política de compra antes de continuar."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/reserve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "assigned" ? { seatIds: selectedIds, policyAccepted } : { policyAccepted }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.requiresPayment && body.url) { window.location.href = body.url; return; }
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
  if (paymentResult === "success") return <div className="border border-green-200 bg-green-50 p-7 text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-green-700" /><h2 className="mt-4 font-serif text-2xl font-bold text-navy">Confirmando tu pago</h2><p className="mt-2 text-sm text-ink-soft">No cierres esta página. Tus lugares quedarán confirmados en unos segundos.</p></div>;
  if (paymentResult === "cancelled") return <div className="border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="font-serif text-2xl font-bold text-navy">Pago cancelado</h2><p className="mt-2 text-sm text-ink-soft">No se realizó ningún cargo. Estamos liberando los lugares seleccionados.</p></div>;
  if (reservations.length > 0) return (
    <div className="border border-gold/40 bg-gold/10 p-7 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-gold-deep" />
      <h2 className="mt-4 font-serif text-2xl font-bold text-navy">{reservations.length > 1 ? "Tus lugares están reservados" : "Tu lugar está reservado"}</h2>
      {mode === "assigned" ? (
        <><p className="mt-2 text-ink-soft">Asientos <strong>{reservations.map((item) => item.x !== null ? item.row_label : `${item.row_label ?? ""}${item.seat_number ?? ""}`).join(", ")}</strong></p>{reservations.some((item) => Number(item.unit_price) > 0) ? <p className="mt-2 text-sm font-semibold text-navy">Total: ${reservations.reduce((sum, item) => sum + Number(item.unit_price), 0).toLocaleString("es-MX")} MXN</p> : null}</>
      ) : <p className="mt-2 text-ink-soft">Tu acceso es de lugar libre; al llegar podrás ocupar el lugar disponible que prefieras.</p>}
    </div>
  );

  if (pendingPayment) return (
    <div className="border border-amber-300 bg-amber-50 p-7">
      <div className="flex items-start gap-4"><AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-amber-700" /><div>
        <h2 className="font-serif text-2xl font-bold text-navy">Pago pendiente — reservación no confirmada</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Los asientos <strong>{pendingPayment.seats.filter(Boolean).join(", ") || "seleccionados"}</strong> están apartados temporalmente mientras se completa Mercado Pago. No están reservados definitivamente y no aparecerán como pagados.</p>
        <p className="mt-2 text-xs font-semibold text-amber-800">El apartado vence a las {new Date(pendingPayment.expires_at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" })}. Si cerraste Mercado Pago, libéralos ahora.</p>
        <button type="button" onClick={releasePendingPayment} disabled={cancellingPending} className="mt-5 inline-flex min-h-11 items-center justify-center border border-amber-700 px-5 text-xs font-bold uppercase tracking-[0.14em] text-amber-900 hover:bg-amber-100 disabled:opacity-50">{cancellingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar intento y liberar asientos"}</button>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div></div>
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
        <p className="mt-4 text-sm font-semibold text-navy">Quedan {remaining} de {capacity} lugares{seatPrice > 0 ? ` · ${seatPrice.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}` : " · Gratuito"}</p>
      </div></div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {seatPrice > 0 ? <PurchasePolicy checked={policyAccepted} onChange={setPolicyAccepted} /> : null}
      <button onClick={reserve} disabled={loading || remaining === 0 || (seatPrice > 0 && !policyAccepted)} className="btn-primary mt-6 w-full justify-center sm:w-auto">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : remaining === 0 ? "Cupo completo" : seatPrice > 0 ? "Continuar al pago" : "Reservar mi lugar"}</button>
    </div>;
  }

  const selected = seats.filter((seat) => selectedIds.includes(seat.id));
  const toggleSeat = (seatId: string) => setSelectedIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  const selectedNames = selected.map((seat) => seat.x !== null ? seat.row_label : `${seat.row_label}${seat.seat_number}`);
  const compactNames = selectedNames.length > 4 ? `${selectedNames.slice(0, 4).join(", ")} y ${selectedNames.length - 4} más` : selectedNames.join(", ");
  const confirmText = loading ? <Loader2 className="h-4 w-4 animate-spin" /> : paymentRequired ? `Pagar ${selectedIds.length > 1 ? `${selectedIds.length} asientos` : "asiento"}` : selectedIds.length > 1 ? `Confirmar ${selectedIds.length} asientos` : "Confirmar asiento";
  const reservationControls = (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-gold/30 bg-cream-light/95 px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(10,29,54,.16)] backdrop-blur sm:static sm:mt-6 sm:flex sm:justify-between sm:border-line sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:shadow-none" aria-live="polite">
      <p className="min-w-0 text-sm text-ink-soft">
        {selected.length > 0 ? <><strong className="block text-navy sm:inline">{selected.length} {selected.length === 1 ? "asiento" : "asientos"}</strong><span className="block truncate sm:ml-1 sm:inline">{compactNames}{selectedTotal > 0 ? ` · $${selectedTotal.toLocaleString("es-MX")} MXN` : " · Sin costo"}</span></> : "Selecciona uno o varios lugares"}
      </p>
      <button onClick={reserve} disabled={loading || selectedIds.length === 0 || (paymentRequired && !policyAccepted)} className="btn-primary min-h-11 shrink-0 justify-center px-4">{confirmText}</button>
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
      {paymentRequired ? <PurchasePolicy checked={policyAccepted} onChange={setPolicyAccepted} /> : null}
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
        defaultSeatPrice={seatPrice}
      />
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted sm:text-xs"><span><strong className="text-gold-deep">Dorado</strong> seleccionado</span><span><strong className="text-red-800">Rojo</strong> ocupado</span></div>
    {paymentRequired ? <PurchasePolicy checked={policyAccepted} onChange={setPolicyAccepted} /> : null}
    {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    {reservationControls}
  </div>;
}

function PurchasePolicy({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="mt-5 flex cursor-pointer items-start gap-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#BD9040]" />
    <span><strong className="block text-navy">Política de compra y asignación de lugar</strong><span className="mt-1 block text-xs leading-relaxed">Entiendo que, una vez confirmado el pago, la reservación y los asientos elegidos son definitivos. No se permiten cancelaciones, cambios ni reembolsos.</span></span>
  </label>;
}
