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
  { name: "Zona superior izquierda", viewBox: [0, 0, 500, 325] },
  { name: "Zona superior derecha", viewBox: [500, 0, 500, 325] },
  { name: "Zona inferior izquierda", viewBox: [0, 325, 500, 325] },
  { name: "Zona inferior derecha", viewBox: [500, 325, 500, 325] },
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
  const occupied = seats.filter((seat) => seat.status === "occupied" || seat.holder_name);
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
          <div className={styles.legend}><span className={styles.legendItem}><span className={styles.dot} /> Asiento reservado</span><span>El nombre abreviado aparece junto al lugar; la lista inferior conserva el nombre completo.</span></div>
          <h2 className={styles.listTitle}>{index === 0 ? `Resumen · ${occupied.length} lugares ocupados` : `Personas en esta zona · ${regionSeats.length}`}</h2>
          {regionSeats.length ? <div className={styles.roster}>{regionSeats.map((seat) => <div className={styles.rosterItem} key={seat.id}><span className={styles.seatCode}>{seat.row_label}</span><span className={styles.personName}>{seat.holder_name || "Ocupado"}{seat.reservation_status === "pending" ? " · pago pendiente" : ""}</span></div>)}</div> : <p className={styles.empty}>No hay lugares reservados en esta zona.</p>}
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
    {visibleSeats.map((seat) => seat.x !== null && seat.y !== null ? <circle key={`seat-${seat.id}`} cx={seat.x} cy={seat.y} r={overview ? 3.4 : 4.2} fill={seat.status === "occupied" ? "#8f2027" : "rgba(255,255,255,.72)"} stroke={seat.status === "occupied" ? "#5f1116" : "#9b7620"} strokeWidth={overview ? 1 : 1.4} /> : null)}
    {occupied.map((seat, index) => <SeatName key={seat.id} seat={seat} index={index} overview={overview} region={region.viewBox} />)}
  </svg>;
}

function SeatName({ seat, index, overview, region }: { seat: PrintSeat; index: number; overview: boolean; region: Region["viewBox"] }) {
  if (seat.x === null || seat.y === null) return null;
  const name = shortName(seat.holder_name || "Ocupado");
  const fontSize = overview ? 5.5 : 7;
  const boxHeight = overview ? 9 : 11;
  const boxWidth = Math.max(overview ? 30 : 42, name.length * (overview ? 3.2 : 4.1) + 8);
  const placeLeft = index % 2 === 1;
  const desiredX = placeLeft ? seat.x - boxWidth - 8 : seat.x + 8;
  const labelX = Math.max(region[0] + 2, Math.min(desiredX, region[0] + region[2] - boxWidth - 2));
  const labelY = Math.max(region[1] + boxHeight + 2, Math.min(seat.y - 7, region[1] + region[3] - 3));
  return <g>
    <line x1={seat.x} y1={seat.y} x2={placeLeft ? labelX + boxWidth : labelX} y2={labelY - boxHeight / 2} stroke="#7f1d1d" strokeWidth={overview ? .7 : 1} />
    <rect x={labelX} y={labelY - boxHeight} width={boxWidth} height={boxHeight} rx={2} fill="#fffdf7" stroke="#7f1d1d" strokeWidth={overview ? .7 : 1} />
    <text x={labelX + 3} y={labelY - (overview ? 2.7 : 3.2)} fontFamily="Arial, sans-serif" fontSize={fontSize} fontWeight="700" fill="#132746">{name}</text>
  </g>;
}

function Furniture({ tables }: { tables: VenueTable[] }) {
  return <>{tables.map((table) => table.kind === "round"
    ? <circle key={table.id} cx={table.x} cy={table.y} r={table.width / 2} fill="#eee8da" stroke="#5d6776" />
    : <rect key={table.id} x={table.x - table.width / 2} y={table.y - table.height / 2} width={table.width} height={table.height} rx={table.kind === "wall" ? 0 : 3} transform={`rotate(${table.rotation} ${table.x} ${table.y})`} fill={table.kind === "wall" ? "#132746" : "#eee8da"} stroke="#5d6776" />)}</>;
}

function isInside(seat: PrintSeat, [x, y, width, height]: Region["viewBox"]) {
  return seat.x !== null && seat.y !== null && seat.x >= x && seat.x <= x + width && seat.y >= y && seat.y <= y + height;
}

function shortName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const short = parts.length > 2 ? `${parts[0]} ${parts.at(-1)}` : parts.join(" ");
  return short.length > 18 ? `${short.slice(0, 17)}…` : short;
}
