"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Printer, User } from "lucide-react";
import type { VenueTable } from "@/lib/venue-layout";
import InteractiveSeatPlan, { type SeatPlanType } from "@/components/InteractiveSeatPlan";

type SeatingMode = "none" | "open" | "assigned";
type Seat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number };
type Reservation = { id: string; seat_id: string | null; holder_name: string; holder_email: string; holder_phone: string | null; created_at: string };

export default function EventSeatsAdmin({ eventId, seatingMode, planType, capacity, seats, reservations, reservationCount, venueTables, canViewReservations }: {
  eventId: string;
  seatingMode: SeatingMode;
  planType: SeatPlanType;
  capacity: number | null;
  seats: Seat[];
  reservations: Reservation[];
  reservationCount: number;
  venueTables: VenueTable[];
  canViewReservations: boolean;
}) {
  const router = useRouter();
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [courtesySeatIds, setCourtesySeatIds] = useState<string[]>([]);
  const [courtesyName, setCourtesyName] = useState("Cortesía del Midrash");
  const [savingCourtesy, setSavingCourtesy] = useState(false);
  const [courtesyError, setCourtesyError] = useState("");
  const [courtesySuccess, setCourtesySuccess] = useState("");

  const reservationBySeat = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const r of reservations) if (r.seat_id) map.set(r.seat_id, r);
    return map;
  }, [reservations]);

  if (seatingMode === "none") {
    return <div className="rounded-xl border border-midrash-100 bg-white p-6 text-sm text-midrash-600">Este evento no tiene reservaciones.</div>;
  }

  if (seatingMode === "open") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-midrash-700"><strong>{reservationCount}</strong> de <strong>{capacity ?? 0}</strong> lugares reservados.</p>
        {canViewReservations ? (
          <ReservationsTable reservations={reservations} showSeat={false} />
        ) : (
          <PrivacyNotice />
        )}
      </div>
    );
  }

  const selectedReservation = selectedSeatId ? reservationBySeat.get(selectedSeatId) : null;
  const selectedSeat = selectedSeatId ? seats.find((s) => s.id === selectedSeatId) : null;
  const occupiedCount = seats.filter((s) => s.status === "occupied").length;

  function selectSeat(seatId: string) {
    const seat = seats.find((item) => item.id === seatId);
    setSelectedSeatId(seatId);
    setCourtesyError("");
    setCourtesySuccess("");
    if (!canViewReservations || !seat || seat.status === "occupied") return;
    setCourtesySeatIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  }

  async function reserveCourtesy() {
    if (!courtesySeatIds.length) return;
    setSavingCourtesy(true);
    setCourtesyError("");
    setCourtesySuccess("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, seat_ids: courtesySeatIds, holder_name: courtesyName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No fue posible apartar los asientos");
      setCourtesySuccess(`${courtesySeatIds.length} ${courtesySeatIds.length === 1 ? "asiento reservado" : "asientos reservados"} como cortesía sin costo.`);
      setCourtesySeatIds([]);
      setSelectedSeatId(null);
      router.refresh();
    } catch (caught) {
      setCourtesyError(caught instanceof Error ? caught.message : "No fue posible apartar los asientos");
    } finally {
      setSavingCourtesy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-midrash-700"><strong>{occupiedCount}</strong> de <strong>{seats.length}</strong> asientos reservados.</p>
        {canViewReservations ? <a href={`/admin/events/${eventId}/seating-chart`} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Imprimir plano con nombres</a> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <InteractiveSeatPlan
          seats={seats}
          venueTables={venueTables}
          selectedSeatId={selectedSeatId}
          selectedSeatIds={courtesySeatIds}
          onSelect={selectSeat}
          allowOccupiedSelection
          planType={planType}
        />
        <div className="space-y-4">
          <div className="flex gap-4 text-xs text-midrash-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-navy bg-white" /> Libre</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-red-500 bg-red-100" /> Ocupado</span>
          </div>
          {canViewReservations ? (
            <div className="rounded-xl border border-gold/35 bg-gold/10 p-4">
              <p className="flex items-center gap-2 font-serif text-lg font-bold text-navy"><Gift className="h-4 w-4 text-gold-deep" /> Cortesías del administrador</p>
              <p className="mt-1 text-xs leading-relaxed text-midrash-600">Selecciona uno o varios asientos libres en el plano. Se ocuparán inmediatamente y no generarán ningún cobro.</p>
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-midrash-600">Nombre o referencia</label>
              <input value={courtesyName} onChange={(event) => setCourtesyName(event.target.value)} maxLength={120} className="input mt-1 normal-case" placeholder="Cortesía del Midrash" />
              <button type="button" onClick={reserveCourtesy} disabled={savingCourtesy || courtesySeatIds.length === 0} className="btn-primary mt-3 w-full justify-center disabled:opacity-50">
                {savingCourtesy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Reservar sin costo${courtesySeatIds.length ? ` (${courtesySeatIds.length})` : ""}`}
              </button>
              {courtesySuccess ? <p className="mt-2 text-xs font-semibold text-green-700">{courtesySuccess}</p> : null}
              {courtesyError ? <p className="mt-2 text-xs text-red-700">{courtesyError}</p> : null}
            </div>
          ) : null}
          {selectedSeatId ? (
            <div className="rounded-xl border border-midrash-200 bg-midrash-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">Asiento {selectedSeat?.row_label}</p>
              {selectedReservation && canViewReservations ? (
                <div className="mt-2 space-y-1">
                  <p className="flex items-center gap-1.5 font-serif text-lg font-bold text-navy"><User className="h-4 w-4 text-gold-deep" /> {selectedReservation.holder_name}</p>
                  <p className="text-sm text-midrash-600">{selectedReservation.holder_email}</p>
                  {selectedReservation.holder_phone ? <p className="text-sm text-midrash-600">{selectedReservation.holder_phone}</p> : null}
                  <p className="mt-2 text-xs text-midrash-400">Reservado el {new Date(selectedReservation.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              ) : selectedSeat?.status === "occupied" ? (
                <p className="mt-2 text-sm text-midrash-500">Ocupado. Los datos personales solo están disponibles para Administradores y Propietarios.</p>
              ) : (
                <p className="mt-2 text-sm text-midrash-500">{courtesySeatIds.includes(selectedSeatId) ? "Seleccionado para cortesía sin costo." : "Disponible — nadie lo ha reservado."}</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs text-midrash-500">
              {canViewReservations ? "Haz click en un asiento para ver quién lo reservó." : "Haz click en un asiento para consultar si está disponible u ocupado."}
            </div>
          )}
          {canViewReservations ? <ReservationsTable reservations={reservations} showSeat seats={seats} /> : <PrivacyNotice />}
        </div>
      </div>
    </div>
  );
}

function ReservationsTable({ reservations, showSeat, seats }: { reservations: Reservation[]; showSeat: boolean; seats?: Seat[] }) {
  if (reservations.length === 0) return <p className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs text-midrash-500">Todavía nadie ha reservado.</p>;
  const seatLabel = (seatId: string | null) => (showSeat && seats ? seats.find((s) => s.id === seatId)?.row_label ?? "—" : null);
  return (
    <div className="overflow-x-auto rounded-xl border border-midrash-100 bg-white">
      <table className="w-full min-w-[520px] table-fixed divide-y divide-midrash-100 text-sm">
        <thead className="bg-midrash-50"><tr>
          {showSeat ? <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-midrash-600">Asiento</th> : null}
          <th className="w-[30%] px-3 py-2 text-left text-[11px] font-semibold uppercase text-midrash-600">Nombre</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-midrash-600">Contacto</th>
        </tr></thead>
        <tbody className="divide-y divide-midrash-100">
          {reservations.map((r) => (
            <tr key={r.id}>
              {showSeat ? <td className="px-3 py-2 font-serif font-bold text-navy">{seatLabel(r.seat_id)}</td> : null}
              <td className="break-words px-3 py-2 text-midrash-900">{r.holder_name}</td>
              <td className="break-all px-3 py-2 text-midrash-600">{r.holder_email}{r.holder_phone ? ` · ${r.holder_phone}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrivacyNotice() {
  return (
    <p className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs leading-relaxed text-midrash-500">
      Puedes consultar ocupación y disponibilidad. Los nombres y datos de contacto están protegidos y solo son visibles para Administradores y Propietarios.
    </p>
  );
}
