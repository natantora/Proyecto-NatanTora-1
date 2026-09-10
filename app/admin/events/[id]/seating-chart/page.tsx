import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManageSeats, type Role } from "@/lib/permissions";
import { getEventVenueTables, type VenueTable } from "@/lib/venue-layout";
import { CANVAS_H, CANVAS_W } from "@/lib/venue-canvas";
import CustomPlanFloorZone from "@/components/CustomPlanFloorZone";
import PrintButton from "./PrintButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type EventRecord = { id: string; title: string; event_date: Date; location: string | null; seating_mode: string; seat_plan_type: "architectural" | "custom" };
type PrintSeat = { id: string; row_label: string; seat_number: number; status: "available" | "occupied"; x: number | null; y: number | null; rotation: number; holder_name: string | null; reservation_status: string | null };
type Region = { name: string; viewBox: [number, number, number, number] };

const DETAIL_REGIONS: Region[] = [
  { name: "Zona superior izquierda", viewBox: [0, 0, CANVAS_W / 3, CANVAS_H / 2] },
  { name: "Zona superior central", viewBox: [CANVAS_W / 3, 0, CANVAS_W / 3, CANVAS_H / 2] },
  { name: "Zona superior derecha", viewBox: [(CANVAS_W / 3) * 2, 0, CANVAS_W / 3, CANVAS_H / 2] },
  { name: "Zona inferior izquierda", viewBox: [0, CANVAS_H / 2, CANVAS_W / 3, CANVAS_H / 2] },
  { name: "Zona inferior central", viewBox: [CANVAS_W / 3, CANVAS_H / 2, CANVAS_W / 3, CANVAS_H / 2] },
  { name: "Zona inferior derecha", viewBox: [(CANVAS_W / 3) * 2, CANVAS_H / 2, CANVAS_W / 3, CANVAS_H / 2] },
];

export default async function PrintableSeatingChartPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.status !== "approved" || !canManageSeats(admin.role as Role)) redirect("/admin/dashboard");
  const { id } = await params;
  const eventResult = await query<EventRecord>("SELECT id, title, event_date, location, seating_mode, seat_plan_type FROM events WHERE id = $1 LIMIT 1", [id]);
  const event = eventResult.rows[0];
  if (!event) notFound();
  if (event.seating_mode !== "assigned") redirect(`/admin/events/${id}`);

  const [seatResult, venueTables] = await Promise.all([
    query<PrintSeat>(
      `SELECT seat.id, seat.row_label, seat.seat_number, seat.status, seat.x, seat.y, seat.rotation,
              reservation.holder_name, reservation.status AS reservation_status
         FROM event_seats seat
    LEFT JOIN LATERAL (
               SELECT holder_name, status
                 FROM event_reservations
                WHERE event_id = seat.event_id AND seat_id = seat.id
                  AND (status = 'confirmed' OR (status = 'pending' AND expires_at > NOW()))
                ORDER BY CASE WHEN status = 'confirmed' THEN 0 ELSE 1 END, created_at DESC
                LIMIT 1
              ) reservation ON TRUE
        WHERE seat.event_id = $1 AND seat.retired = FALSE
        ORDER BY seat.row_label, seat.seat_number`,
      [id],
    ),
    getEventVenueTables(id),
  ]);
  const seats = seatResult.rows.filter((seat) => seat.x !== null && seat.y !== null);
  const occupied = seats.filter((seat) => seat.status === "occupied" || seat.holder_name).sort(compareSeats);
  const regions: Region[] = [{ name: "Vista general", viewBox: [0, 0, CANVAS_W, CANVAS_H] }, ...DETAIL_REGIONS];

  return <main>
    <div className={styles.screenBar}>
      <Link href={`/admin/events/${id}`} className={styles.backLink}>← Volver al evento</Link>
      <PrintButton />
    </div>
    <div className={styles.document}>
      {regions.map((region, index) => {
        const regionSeats = occupied.filter((seat) => isInside(seat, region.viewBox));
        return <section className={styles.sheet} key={region.name}>
          <header className={styles.header}>
            <div><p className={styles.eyebrow}>Plano de lugares reservados</p><h1 className={styles.title}>{event.title}</h1><p className={styles.meta}>{new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} · {event.location || "Midrash Natán Torá"}</p></div>
            <div className={styles.pageName}>{region.name}<br />Hoja {index + 1} de {regions.length}</div>
          </header>
          <SeatChart event={event} seats={seats} occupied={regionSeats} tables={venueTables} region={region} overview={index === 0} />
          <div className={styles.legend}><span className={styles.legendItem}><span className={styles.dot} /> Asiento reservado</span><span>Los nombres aparecen directamente junto a cada lugar, siguiendo la orientación de la fila. La lista inferior conserva el nombre completo.</span></div>
          <h2 className={styles.listTitle}>{index === 0 ? `Resumen · ${occupied.length} lugares ocupados` : `Personas en esta zona · ${regionSeats.length}`}</h2>
          {regionSeats.length ? <div className={styles.roster}>{regionSeats.sort(compareSeats).map((seat) => <div className={styles.rosterItem} key={seat.id}><span className={styles.seatCode}>{seat.row_label}</span><span className={styles.personName}>{seat.holder_name || "Ocupado"}</span>{seat.reservation_status === "pending" ? <span className={styles.pending}>Pendiente</span> : null}</div>)}</div> : <p className={styles.empty}>No hay lugares reservados en esta zona.</p>}
        </section>;
      })}
    </div>
  </main>;
}

function SeatChart({ event, seats, occupied, tables, region, overview }: { event: EventRecord; seats: PrintSeat[]; occupied: PrintSeat[]; tables: VenueTable[]; region: Region; overview: boolean }) {
  const [x, y, width, height] = region.viewBox;
  const visibleSeats = seats.filter((seat) => isInside(seat, region.viewBox));
  return <svg className={styles.plan} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${region.name} con nombres de personas reservadas`}>
    {event.seat_plan_type === "architectural" ? <image href="/venue-plan-reference.png" x="0" y="0" width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="none" /> : <><CustomPlanFloorZone /><Furniture tables={tables} /></>}
    {visibleSeats.filter((seat) => !(seat.status === "occupied" || seat.holder_name)).map((seat) => seat.x !== null && seat.y !== null ? <circle key={`seat-${seat.id}`} cx={seat.x} cy={seat.y} r={overview ? 2.8 : 4} fill="rgba(255,255,255,.78)" stroke="#9b7620" strokeWidth={overview ? .8 : 1.2} /> : null)}
    {occupied.map((seat) => <ReservedSeatMarker key={seat.id} seat={seat} overview={overview} />)}
  </svg>;
}

function ReservedSeatMarker({ seat, overview }: { seat: PrintSeat; overview: boolean }) {
  if (seat.x === null || seat.y === null) return null;
  if (overview) return <circle cx={seat.x} cy={seat.y} r={3.4} fill="#9f252b" stroke="#68151a" strokeWidth={1} />;

  // The reference plans place each name directly beside its chair, without a
  // callout box. Rotating the label perpendicular to the chair keeps dense
  // rows legible and mirrors the way names are typeset on the 2025 plan.
  const labelAngle = readableAngle(seat.rotation + 90);
  const offsetAngle = ((seat.rotation + 90) * Math.PI) / 180;
  const labelX = seat.x + Math.cos(offsetAngle) * 7.5;
  const labelY = seat.y + Math.sin(offsetAngle) * 7.5;
  const name = compactPlanName(seat.holder_name || "Ocupado");
  return <g>
    <circle cx={seat.x} cy={seat.y} r={3.5} fill="#9f252b" stroke="#68151a" strokeWidth={.9} />
    <line x1={seat.x} y1={seat.y} x2={labelX} y2={labelY} stroke="#a8a39a" strokeWidth={.65} />
    <text
      x={labelX}
      y={labelY}
      transform={`rotate(${labelAngle} ${labelX} ${labelY})`}
      textAnchor="start"
      dominantBaseline="middle"
      fontFamily="Arial, sans-serif"
      fontSize="4.6"
      fontWeight="500"
      letterSpacing=".12"
      fill="#585f68"
    >{name}</text>
  </g>;
}

function compactPlanName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
  if (normalized.length <= 22) return normalized;
  const parts = normalized.split(" ");
  if (parts.length > 1) {
    const firstAndLast = `${parts[0]} ${parts[parts.length - 1]}`;
    if (firstAndLast.length <= 22) return firstAndLast;
  }
  return `${normalized.slice(0, 21).trimEnd()}…`;
}

function readableAngle(value: number): number {
  let angle = ((value % 360) + 360) % 360;
  if (angle > 90 && angle <= 270) angle -= 180;
  return angle;
}

function Furniture({ tables }: { tables: VenueTable[] }) {
  return <>{tables.map((table) => table.kind === "round"
    ? <circle key={table.id} cx={table.x} cy={table.y} r={table.width / 2} fill="#eee8da" stroke="#5d6776" />
    : <rect key={table.id} x={table.x - table.width / 2} y={table.y - table.height / 2} width={table.width} height={table.height} rx={table.kind === "wall" ? 0 : 3} transform={`rotate(${table.rotation} ${table.x} ${table.y})`} fill={table.kind === "wall" ? "#132746" : "#eee8da"} stroke="#5d6776" />)}</>;
}

function isInside(seat: PrintSeat, [x, y, width, height]: Region["viewBox"]) {
  return seat.x !== null && seat.y !== null && seat.x >= x && seat.x <= x + width && seat.y >= y && seat.y <= y + height;
}

function compareSeats(a: PrintSeat, b: PrintSeat) {
  const aNumber = Number(a.row_label);
  const bNumber = Number(b.row_label);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber || a.seat_number - b.seat_number;
  return a.row_label.localeCompare(b.row_label, "es", { numeric: true }) || a.seat_number - b.seat_number;
}
