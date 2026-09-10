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
  const region: Region = { name: "Vista general", viewBox: [0, 0, CANVAS_W, CANVAS_H] };

  return <main className={styles.printPage}>
    <div className={styles.screenBar}>
      <Link href={`/admin/events/${id}`} className={styles.backLink}>← Volver al evento</Link>
      <PrintButton />
    </div>
    <div className={styles.document}>
      <section className={styles.sheet}>
          <SeatChart event={event} occupied={occupied} tables={venueTables} region={region} />
      </section>
    </div>
  </main>;
}

function SeatChart({ event, occupied, tables, region }: { event: EventRecord; occupied: PrintSeat[]; tables: VenueTable[]; region: Region }) {
  const [x, y, width, height] = region.viewBox;
  return <svg className={styles.plan} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${region.name} con nombres de personas reservadas`}>
    <image href="/venue-plan-reference.png" x="0" y="0" width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="none" />
    {event.seat_plan_type === "custom" ? <><CustomPlanFloorZone opacity={0.2} /><Furniture tables={tables} /></> : null}
    {occupied.map((seat) => <ReservedSeatMarker key={seat.id} seat={seat} />)}
  </svg>;
}

function ReservedSeatMarker({ seat }: { seat: PrintSeat }) {
  if (seat.x === null || seat.y === null) return null;
  const seatX = seat.x;
  const seatY = seat.y;

  // Keep the complete holder name in the reservation, but use a compact print
  // label when necessary so every label remains legible inside its chair.
  const name = (seat.holder_name || "Ocupado").trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
  const lines = compactPlanName(name);
  const fontSize = planNameFontSize(lines);
  const lineHeight = fontSize * .92;
  const firstLineY = seatY - ((lines.length - 1) * lineHeight) / 2;
  const clipId = `seat-name-${seat.id}`;
  const printX = seatX;
  const printY = seatY - 20;
  const printFontSize = planPrintNameFontSize(lines);
  const printLineHeight = printFontSize * .92;
  const printFirstLineY = printY - ((lines.length - 1) * printLineHeight) / 2;
  const printClipId = `print-seat-name-${seat.id}`;
  return <>
  <g className={styles.screenName} transform={`rotate(${readableAngle(seat.rotation)} ${seatX} ${seatY})`}>
    <defs><clipPath id={clipId}><rect x={seatX - 9} y={seatY - 8} width={18} height={16} rx={1.5} /></clipPath></defs>
    <text
      x={seatX}
      y={firstLineY}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="Arial Narrow, Arial, sans-serif"
      fontSize={fontSize}
      fontWeight="700"
      letterSpacing="0"
      fill="#111827"
      stroke="#ffffff"
      strokeWidth={.55}
      paintOrder="stroke"
      clipPath={`url(#${clipId})`}
    >{lines.map((line, index) => <tspan key={`${seat.id}-${index}`} x={seatX} y={firstLineY + index * lineHeight}>{line}</tspan>)}</text>
  </g>
  <g className={styles.printName} transform={`rotate(${readableAngle(seat.rotation)} ${printX} ${printY})`}>
    <defs><clipPath id={printClipId}><rect x={printX - 13} y={printY - 10} width={26} height={20} rx={1.5} /></clipPath></defs>
    <text
      x={printX}
      y={printFirstLineY}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="Arial Narrow, Arial, sans-serif"
      fontSize={printFontSize}
      fontWeight="800"
      letterSpacing="0"
      fill="#071a35"
      stroke="#ffffff"
      strokeWidth={.8}
      paintOrder="stroke"
      clipPath={`url(#${printClipId})`}
    >{lines.map((line, index) => <tspan key={`print-${seat.id}-${index}`} x={printX} y={printFirstLineY + index * printLineHeight}>{line}</tspan>)}</text>
  </g>
  </>;
}

const PRINT_NAME_OVERRIDES: Record<string, string[]> = {
  "ANITA CHAYO CHALOM": ["ANITA", "CHAYO C."],
  "CARLOS CHAYO COHEN": ["CARLOS", "CHAYO C."],
  "MARCOS MICHAN ASQUENAZI": ["MARCOS", "MICHAN A."],
  "MICHAN ASQUENAZI": ["MICHAN", "ASQ."],
  "SUSY ESQUENAZI": ["SUSY", "ESQ."],
  "LUGARES HOMBRES": ["HOMBRES"],
};

function compactPlanName(name: string): string[] {
  const override = PRINT_NAME_OVERRIDES[name];
  if (override) return override;

  if (name.includes("/")) {
    const parts = name.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, 2);
  }

  const lines = splitPlanName(name);
  if (Math.max(...lines.map((line) => line.length), 0) <= 10) return lines;

  const words = name.split(" ");
  if (words.length >= 3) {
    return [words[0], `${words[1]} ${words.slice(2).map((word) => `${word[0]}.`).join("")}`];
  }
  if (words.length === 2) {
    const [first, last] = words;
    return first.length >= last.length
      ? [`${first.slice(0, 7)}.`, last]
      : [first, `${last.slice(0, 7)}.`];
  }
  return [`${name.slice(0, 9)}.`];
}

function splitPlanName(name: string): string[] {
  const words = name.split(" ");
  const maxLines = 2;
  const targetLength = Math.ceil((name.length - Math.max(words.length - 1, 0)) / maxLines);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (!current || (lines.length < maxLines && current.length + 1 + word.length > targetLength)) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  while (lines.length > maxLines) {
    const overflow = lines.pop();
    if (overflow) lines[lines.length - 1] = `${lines[lines.length - 1]} ${overflow}`;
  }
  return lines;
}

function planNameFontSize(lines: string[]): number {
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const fitWidth = 17.5 / (longestLine * .45);
  const fitHeight = 14 / (lines.length * .92);
  return Math.min(5.2, fitWidth, fitHeight);
}

function planPrintNameFontSize(lines: string[]): number {
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const fitWidth = 25 / (longestLine * .45);
  const fitHeight = 18 / (lines.length * .92);
  return Math.min(7.2, fitWidth, fitHeight);
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

function compareSeats(a: PrintSeat, b: PrintSeat) {
  const aNumber = Number(a.row_label);
  const bNumber = Number(b.row_label);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber || a.seat_number - b.seat_number;
  return a.row_label.localeCompare(b.row_label, "es", { numeric: true }) || a.seat_number - b.seat_number;
}
