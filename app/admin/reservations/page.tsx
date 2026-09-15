import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Armchair, Users, WalletCards, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManageSeats, type Role } from "@/lib/permissions";
import { formatMXN } from "@/lib/utils";
import ReservationActions from "./ReservationActions";

export const dynamic = "force-dynamic";

type ReservationRow = {
  id: string;
  event_id: string;
  user_id: string | null;
  payment_id: string | null;
  holder_name: string;
  holder_email: string;
  holder_phone: string | null;
  unit_price: string | number;
  created_at: Date;
  event_title: string;
  event_date: Date;
  seat_id: string | null;
  row_label: string | null;
  seat_number: number | null;
  x: number | null;
  reservation_status: string;
  payment_status: string | null;
};

type ReservationGroup = {
  key: string;
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  userId: string | null;
  name: string;
  names: string[];
  email: string;
  phone: string | null;
  createdAt: Date;
  seats: string[];
  quantity: number;
  total: number;
  reservationStatus: string;
  paymentStatus: string | null;
};

export default async function ReservationsAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canManageSeats(user.role as Role)) redirect("/admin/dashboard");
  const params = await searchParams;

  const result = await query<ReservationRow>(
    `SELECT reservation.id, reservation.event_id, reservation.user_id, reservation.payment_id,
            reservation.holder_name, reservation.holder_email, reservation.holder_phone,
            reservation.unit_price, reservation.created_at,
            event.title AS event_title, event.event_date,
            seat.id AS seat_id, seat.row_label, seat.seat_number, seat.x,
            reservation.status AS reservation_status, payment.status AS payment_status
       FROM event_reservations reservation
       JOIN events event ON event.id = reservation.event_id
  LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
  LEFT JOIN payments payment ON payment.id = reservation.payment_id
      WHERE reservation.status IN ('pending', 'confirmed')
   ORDER BY event.event_date DESC, reservation.created_at DESC, seat.row_label, seat.seat_number`,
  );

  const groups = new Map<string, ReservationGroup>();
  for (const row of result.rows) {
    const key = `${row.event_id}:${row.payment_id || row.user_id || row.id}`;
    const current = groups.get(key) ?? {
      key,
      eventId: row.event_id,
      eventTitle: row.event_title,
      eventDate: row.event_date,
      userId: row.user_id,
      name: row.holder_name,
      names: [],
      email: row.holder_email,
      phone: row.holder_phone,
      createdAt: row.created_at,
      seats: [],
      quantity: 0,
      total: 0,
      reservationStatus: row.reservation_status,
      paymentStatus: row.payment_status,
    };
    current.quantity += 1;
    current.names.push(row.holder_name);
    current.total += Number(row.unit_price ?? 0);
    if (row.seat_id) current.seats.push(row.x !== null ? row.row_label ?? "—" : `${row.row_label ?? ""}${row.seat_number ?? ""}`);
    groups.set(key, current);
  }

  const q = (params.q ?? "").trim().toLocaleLowerCase("es-MX");
  const reservations = [...groups.values()].filter((group) => !q || [group.eventTitle, group.names.join(" "), group.email, group.phone ?? "", group.seats.join(" ")].some((value) => value.toLocaleLowerCase("es-MX").includes(q)));
  const reservedPlaces = reservations.reduce((sum, group) => sum + group.quantity, 0);
  const expectedAmount = reservations.reduce((sum, group) => sum + group.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-midrash-900">Reservaciones</h1>
        <p className="mt-1 text-sm text-midrash-600">Cada fila corresponde a una reservación o a una compra realizada para el mismo evento.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Reservaciones y compras" value={String(reservations.length)} />
        <Stat icon={Armchair} label="Lugares reservados" value={String(reservedPlaces)} />
        <Stat icon={WalletCards} label="Importe registrado" value={formatMXN(expectedAmount)} />
      </div>

      <form className="flex max-w-xl gap-2" action="/admin/reservations">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-midrash-400" />
          <input name="q" defaultValue={params.q ?? ""} className="input pl-10 normal-case" placeholder="Buscar persona, correo, evento o asiento" />
        </label>
        <button className="btn-primary justify-center px-5" type="submit">Buscar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-midrash-100 bg-white">
        <table className="w-full min-w-[920px] divide-y divide-midrash-100 text-sm">
          <thead className="bg-midrash-50"><tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Evento</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Persona</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Lugares</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-midrash-600">Cantidad</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Importe</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Fecha</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Estado</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Acciones</th>
          </tr></thead>
          <tbody className="divide-y divide-midrash-100">
            {reservations.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-midrash-500">No hay reservaciones que coincidan.</td></tr> : null}
            {reservations.map((group) => (
              <tr key={group.key}>
                <td className="px-4 py-3"><Link href={`/admin/events/${group.eventId}`} className="font-semibold text-navy hover:text-gold-deep">{group.eventTitle}</Link><div className="mt-0.5 flex items-center gap-1 text-xs text-midrash-500"><CalendarDays className="h-3 w-3" /> {new Date(group.eventDate).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" })}</div></td>
                <td className="px-4 py-3"><div className="space-y-0.5 font-medium text-midrash-900">{(group.seats.length ? [...new Set(group.names)] : group.names).map((name, index, names) => <div key={`${name}-${index}`}>{names.length > 1 ? `${index + 1}. ` : ""}{name}</div>)}</div><div className="mt-1 break-all text-xs text-midrash-500">{group.email}{group.phone ? ` · ${group.phone}` : ""}</div></td>
                <td className="px-4 py-3 font-semibold text-navy">{group.seats.length ? group.seats.join(", ") : "Lugar libre"}</td>
                <td className="px-4 py-3 text-center font-semibold">{group.quantity}</td>
                <td className="px-4 py-3 text-right font-semibold">{group.total > 0 ? formatMXN(group.total) : "Gratuito"}</td>
                <td className="px-4 py-3 text-midrash-600">{new Date(group.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" })}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${group.paymentStatus === "paid" ? "bg-green-100 text-green-800" : group.reservationStatus === "pending" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{group.paymentStatus === "paid" ? "Pagada · definitiva" : group.reservationStatus === "pending" ? "Esperando pago" : "Confirmada"}</span></td>
                <td className="px-4 py-3">{group.userId ? <ReservationActions eventId={group.eventId} userId={group.userId} eventTitle={group.eventTitle} memberName={group.name} paymentStatus={group.paymentStatus} /> : <span className="text-xs text-midrash-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="rounded-xl border border-midrash-100 bg-white p-4"><Icon className="h-5 w-5 text-gold-deep" /><div className="mt-3 font-serif text-2xl font-bold text-navy">{value}</div><div className="text-xs text-midrash-500">{label}</div></div>;
}
