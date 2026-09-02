"use client";

import { useState, useSyncExternalStore } from "react";
import { Minus, Plus } from "lucide-react";
import type { VenueTable } from "@/lib/venue-layout";
import { CANVAS_H, CANVAS_W } from "@/lib/venue-canvas";
import CustomPlanFloorZone from "@/components/CustomPlanFloorZone";

export type SeatPlanSeat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: "available" | "occupied";
  x: number | null;
  y: number | null;
  rotation: number;
  price?: string | number | null;
};

export type SeatPlanType = "architectural" | "custom";

const MOBILE_QUERY = "(max-width: 639px)";
const subscribeToMobile = (callback: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const getMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerMobileSnapshot = () => false;

export default function InteractiveSeatPlan({
  seats,
  venueTables,
  selectedSeatId,
  selectedSeatIds,
  onSelect,
  allowOccupiedSelection = false,
  planImageUrl = "/venue-plan-reference.png",
  planType,
  defaultSeatPrice = 0,
}: {
  seats: SeatPlanSeat[];
  venueTables: VenueTable[];
  selectedSeatId: string | null;
  selectedSeatIds?: string[];
  onSelect?: (seatId: string) => void;
  allowOccupiedSelection?: boolean;
  planImageUrl?: string;
  planType: SeatPlanType;
  defaultSeatPrice?: number;
}) {
  const isMobile = useSyncExternalStore(subscribeToMobile, getMobileSnapshot, getServerMobileSnapshot);
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const maximumZoom = isMobile ? 4 : 2;
  const zoom = Math.min(manualZoom ?? (isMobile ? 2.5 : 1), maximumZoom);

  function selectSeat(seat: SeatPlanSeat) {
    if (!onSelect || (seat.status === "occupied" && !allowOccupiedSelection)) return;
    onSelect(seat.id);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-midrash-200 bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-midrash-100 bg-midrash-50/95 px-3 py-2 backdrop-blur sm:justify-end">
        <span className="text-[11px] font-medium text-midrash-500 sm:hidden">Arrastra para recorrer el plano</span>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden text-[11px] text-midrash-500 sm:inline">Acercamiento</span>
          <button
            type="button"
            onClick={() => setManualZoom(Math.max(1, Number((zoom - (isMobile ? 0.5 : 0.25)).toFixed(2))))}
            disabled={zoom <= 1}
            className="grid min-h-11 min-w-11 place-items-center rounded-md border border-midrash-200 bg-white text-navy disabled:opacity-35 sm:min-h-0 sm:min-w-0 sm:p-1.5"
            aria-label="Alejar plano"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] font-semibold text-midrash-600">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setManualZoom(Math.min(maximumZoom, Number((zoom + (isMobile ? 0.5 : 0.25)).toFixed(2))))}
            disabled={zoom >= maximumZoom}
            className="grid min-h-11 min-w-11 place-items-center rounded-md border border-midrash-200 bg-white text-navy disabled:opacity-35 sm:min-h-0 sm:min-w-0 sm:p-1.5"
            aria-label="Acercar plano"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-auto overscroll-contain bg-white p-1 sm:max-h-none sm:p-2" style={{ touchAction: "pan-x pan-y" }}>
        <svg
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="block h-auto max-w-none"
          style={{ width: `${zoom * 100}%`, minWidth: zoom > 1 ? 700 : undefined }}
          role="img"
          aria-label={planType === "architectural" ? "Plano original del salón con sillas seleccionables" : "Plano personalizado del salón con asientos seleccionables"}
        >
          {planType === "architectural" ? (
            <image
              href={planImageUrl}
              x={0}
              y={0}
              width={CANVAS_W}
              height={CANVAS_H}
              preserveAspectRatio="none"
              className="pointer-events-none"
            />
          ) : (
            <>
              <CustomPlanFloorZone />
              <VenueFurniture tables={venueTables} />
            </>
          )}

          {seats.map((seat) => {
            if (seat.x === null || seat.y === null) return null;
            const occupied = seat.status === "occupied";
            const selected = selectedSeatId === seat.id || selectedSeatIds?.includes(seat.id) === true;
            const canSelect = !!onSelect && (!occupied || allowOccupiedSelection);
            const effectivePrice = Number(seat.price ?? defaultSeatPrice);
            const priceLabel = effectivePrice > 0 ? `, $${effectivePrice.toLocaleString("es-MX")} MXN` : ", sin costo";
            const label = `Asiento ${seat.row_label}${occupied ? ", ocupado" : ", disponible"}${priceLabel}`;

            if (planType === "custom") {
              const fill = selected ? "#d7b35a" : occupied ? "#7f1d1d" : "#ffffff";
              const stroke = selected ? "#9b7620" : occupied ? "#7f1d1d" : "#132746";
              return (
                <g
                  key={seat.id}
                  role={canSelect ? "button" : undefined}
                  tabIndex={canSelect ? 0 : undefined}
                  aria-label={label}
                  onClick={() => selectSeat(seat)}
                  onKeyDown={(event) => {
                    if (canSelect && (event.key === "Enter" || event.key === " ")) selectSeat(seat);
                  }}
                  className={canSelect ? "cursor-pointer" : "cursor-not-allowed"}
                >
                  <title>{label}</title>
                  <rect x={seat.x - 15} y={seat.y - 15} width={30} height={30} fill="transparent" />
                  <g transform={`rotate(${seat.rotation} ${seat.x} ${seat.y})`}>
                    <rect x={seat.x - 9} y={seat.y - 10} width={18} height={3.5} rx={1} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.2} />
                    <rect x={seat.x - 8} y={seat.y - 7} width={16} height={16} rx={2.5} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.2} />
                  </g>
                  <text x={seat.x} y={seat.y + 1} textAnchor="middle" dominantBaseline="middle" className={`pointer-events-none select-none text-[8px] font-bold ${occupied ? "fill-white" : "fill-navy"}`}>
                    {seat.row_label}
                  </text>
                </g>
              );
            }

            const fill = selected ? "rgba(215,179,90,.92)" : occupied ? "rgba(127,29,29,.72)" : "transparent";
            const stroke = selected ? "#9b7620" : occupied ? "#7f1d1d" : "transparent";
            return (
              <g
                key={seat.id}
                role={canSelect ? "button" : undefined}
                tabIndex={canSelect ? 0 : undefined}
                aria-label={label}
                onClick={() => selectSeat(seat)}
                onKeyDown={(event) => {
                  if (canSelect && (event.key === "Enter" || event.key === " ")) selectSeat(seat);
                }}
                className={`${canSelect ? "group cursor-pointer" : "cursor-not-allowed"} focus:outline-none`}
              >
                <title>{label}</title>
                <rect x={seat.x - 15} y={seat.y - 15} width={30} height={30} fill="transparent" />
                <rect
                  x={seat.x - 10}
                  y={seat.y - 10}
                  width={20}
                  height={20}
                  rx={4}
                  transform={`rotate(${seat.rotation} ${seat.x} ${seat.y})`}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selected ? 2.5 : 1.4}
                  className={!selected && !occupied ? "transition-colors group-hover:fill-gold/35 group-hover:stroke-gold-deep group-focus:fill-gold/35 group-focus:stroke-gold-deep" : undefined}
                />
                {selected || occupied ? (
                  <text x={seat.x} y={seat.y + 1} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none select-none fill-white text-[8px] font-bold">
                    {seat.row_label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function VenueFurniture({ tables }: { tables: VenueTable[] }) {
  return tables.map((table) => {
    if (table.kind === "wall") {
      return (
        <rect
          key={table.id}
          x={table.x - table.width / 2}
          y={table.y - table.height / 2}
          width={table.width}
          height={table.height}
          transform={`rotate(${table.rotation} ${table.x} ${table.y})`}
          className="fill-navy"
        />
      );
    }
    if (table.kind === "rect") {
      return (
        <rect
          key={table.id}
          x={table.x - table.width / 2}
          y={table.y - table.height / 2}
          width={table.width}
          height={table.height}
          rx={3}
          transform={`rotate(${table.rotation} ${table.x} ${table.y})`}
          className="fill-navy/10 stroke-navy/40"
        />
      );
    }
    return <circle key={table.id} cx={table.x} cy={table.y} r={table.width / 2} className="fill-navy/10 stroke-navy/40" />;
  });
}
