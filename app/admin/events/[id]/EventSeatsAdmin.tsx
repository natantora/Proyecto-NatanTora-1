"use client";

import { useMemo, useState } from "react";
import { User } from "lucide-react";
import type { VenueTable } from "@/lib/venue-layout";
import { CANVAS_W, CANVAS_H } from "@/lib/venue-canvas";

type SeatingMode = "none" | "open" | "assigned";
type Seat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number };
type Reservation = { id: string; seat_id: string | null; holder_name: string; holder_email: string; holder_phone: string | null; created_at: string };

export default function EventSeatsAdmin({ seatingMode, capacity, seats, reservations, venueTables }: {
  seatingMode: SeatingMode; capacity: number | null; seats: Seat[]; reservations: Reservation[]; venueTables: VenueTable[];
}) {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

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
        <p className="text-sm text-midrash-700"><strong>{reservations.length}</strong> de <strong>{capacity ?? 0}</strong> lugares reservados.</p>
        <ReservationsTable reservations={reservations} showSeat={false} />
      </div>
    );
  }

  const selectedReservation = selectedSeatId ? reservationBySeat.get(selectedSeatId) : null;
  const selectedSeat = selectedSeatId ? seats.find((s) => s.id === selectedSeatId) : null;
  const occupiedCount = seats.filter((s) => s.status === "occupied").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-midrash-700"><strong>{occupiedCount}</strong> de <strong>{seats.length}</strong> asientos reservados.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="overflow-auto rounded-xl border border-midrash-200 bg-white p-2">
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
              if (seat.x === null || seat.y === null) return null;
              const occupied = seat.status === "occupied";
              const isSelected = selectedSeatId === seat.id;
              const cls = isSelected ? "fill-gold stroke-gold-deep" : occupied ? "fill-red-100 stroke-red-500" : "fill-white stroke-navy";
              return (
                <g key={seat.id} onClick={() => setSelectedSeatId(seat.id)} className="cursor-pointer">
                  <g transform={`rotate(${seat.rotation} ${seat.x} ${seat.y})`}>
                    <rect x={seat.x - 9} y={seat.y - 10} width={18} height={3.5} rx={1} className={cls} strokeWidth={isSelected ? 2 : 1.2} />
                    <rect x={seat.x - 8} y={seat.y - 7} width={16} height={16} rx={2.5} className={cls} strokeWidth={isSelected ? 2 : 1.2} />
                  </g>
                  <text x={seat.x} y={seat.y + 1} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none select-none fill-navy text-[8px] font-bold">{seat.row_label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4 text-xs text-midrash-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-navy bg-white" /> Libre</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-red-500 bg-red-100" /> Ocupado</span>
          </div>
          {selectedSeatId ? (
            <div className="rounded-xl border border-midrash-200 bg-midrash-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">Asiento {selectedSeat?.row_label}</p>
              {selectedReservation ? (
                <div className="mt-2 space-y-1">
                  <p className="flex items-center gap-1.5 font-serif text-lg font-bold text-navy"><User className="h-4 w-4 text-gold-deep" /> {selectedReservation.holder_name}</p>
                  <p className="text-sm text-midrash-600">{selectedReservation.holder_email}</p>
                  {selectedReservation.holder_phone ? <p className="text-sm text-midrash-600">{selectedReservation.holder_phone}</p> : null}
                  <p className="mt-2 text-xs text-midrash-400">Reservado el {new Date(selectedReservation.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-midrash-500">Disponible — nadie lo ha reservado.</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs text-midrash-500">Haz click en un asiento para ver quién lo reservó.</div>
          )}
          <ReservationsTable reservations={reservations} showSeat seats={seats} />
        </div>
      </div>
    </div>
  );
}

function ReservationsTable({ reservations, showSeat, seats }: { reservations: Reservation[]; showSeat: boolean; seats?: Seat[] }) {
  if (reservations.length === 0) return <p className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs text-midrash-500">Todavía nadie ha reservado.</p>;
  const seatLabel = (seatId: string | null) => (showSeat && seats ? seats.find((s) => s.id === seatId)?.row_label ?? "—" : null);
  return (
    <div className="overflow-hidden rounded-xl border border-midrash-100 bg-white">
      <table className="min-w-full divide-y divide-midrash-100 text-sm">
        <thead className="bg-midrash-50"><tr>
          {showSeat ? <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-midrash-600">Asiento</th> : null}
          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-midrash-600">Nombre</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-midrash-600">Contacto</th>
        </tr></thead>
        <tbody className="divide-y divide-midrash-100">
          {reservations.map((r) => (
            <tr key={r.id}>
              {showSeat ? <td className="px-3 py-2 font-serif font-bold text-navy">{seatLabel(r.seat_id)}</td> : null}
              <td className="px-3 py-2 text-midrash-900">{r.holder_name}</td>
              <td className="px-3 py-2 text-midrash-600">{r.holder_email}{r.holder_phone ? ` · ${r.holder_phone}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
