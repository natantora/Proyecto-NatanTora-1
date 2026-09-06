import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManagePayments, type Role } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Alert = { id: string; severity: string; category: string; title: string; message: string; occurrence_count: number; last_occurred_at: Date; email_delivery_error: string | null; context: Record<string, unknown> };
type Audit = { id: string; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: Date; actor_name: string | null; actor_email: string | null; account_name: string | null };
type Backup = { status: string; table_count: number; row_count: number; size_bytes: string | null; started_at: Date; completed_at: Date | null; error_message: string | null };
type PaymentReservation = { payment_id: string; holder_name: string; holder_email: string; row_label: string | null; seat_number: number | null; x: number | null };

const actionLabels: Record<string, string> = {
  "account.created": "Cuenta creada", "account.linked": "Vinculación modificada", "account.deleted": "Cuenta eliminada",
  "charge.created": "Cargo creado", "billing_import.completed": "Importación completada", "cash_payment.recorded": "Pago en efectivo registrado",
  "payment.approved": "Pago aprobado", "payment.failed": "Pago fallido", "payment.refunded": "Pago reembolsado", "payment.charged_back": "Contracargo recibido",
};

function date(value: Date) {
  return new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
}

export default async function ControlPage() {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canManagePayments(user.role as Role)) redirect("/admin/dashboard");
  const [alertsResult, auditResult, backupResult] = await Promise.all([
    query<Alert>(`SELECT id, severity, category, title, message, occurrence_count, last_occurred_at, email_delivery_error, context FROM system_alerts WHERE status = 'open' ORDER BY severity = 'critical' DESC, last_occurred_at DESC LIMIT 100`),
    query<Audit>(`SELECT audit.id, audit.action, audit.entity_type, audit.entity_id, audit.metadata, audit.created_at,
      profile.full_name AS actor_name, profile.email AS actor_email, account.display_name AS account_name
      FROM financial_audit_log audit LEFT JOIN profiles profile ON profile.id = audit.actor_id
      LEFT JOIN billing_accounts account ON account.id = audit.account_id ORDER BY audit.created_at DESC LIMIT 250`),
    query<Backup>(`SELECT status, table_count, row_count, size_bytes::text, started_at, completed_at, error_message FROM database_backups ORDER BY started_at DESC LIMIT 1`),
  ]);
  const affectedPaymentIds = alertsResult.rows
    .map((alert) => typeof alert.context?.payment_id === "string" ? alert.context.payment_id : null)
    .filter((id): id is string => Boolean(id));
  const affectedReservations = affectedPaymentIds.length
    ? await query<PaymentReservation>(
      `SELECT reservation.payment_id, reservation.holder_name, reservation.holder_email,
              seat.row_label, seat.seat_number, seat.x
         FROM event_reservations reservation
    LEFT JOIN event_seats seat ON seat.id = reservation.seat_id
        WHERE reservation.payment_id = ANY($1::uuid[])
        ORDER BY reservation.payment_id, seat.row_label, seat.seat_number`,
      [affectedPaymentIds],
    )
    : { rows: [] as PaymentReservation[] };
  const reservationDetails = new Map<string, { name: string; email: string; seats: string[] }>();
  for (const reservation of affectedReservations.rows) {
    const detail = reservationDetails.get(reservation.payment_id) ?? { name: reservation.holder_name, email: reservation.holder_email, seats: [] };
    detail.seats.push(reservation.row_label ? (reservation.x !== null ? reservation.row_label : `${reservation.row_label}${reservation.seat_number || ""}`) : "Lugar libre");
    reservationDetails.set(reservation.payment_id, detail);
  }
  const backup = backupResult.rows[0];
  return <div className="space-y-8">
    <div><div className="eyebrow text-gold">Seguridad operativa</div><h1 className="mt-2 font-serif text-4xl text-navy">Control y auditoría</h1><p className="mt-2 text-sm text-ink-soft">Alertas técnicas, respaldo de la información y registro de movimientos financieros.</p></div>
    <section className="grid gap-4 md:grid-cols-2">
      <div className="border border-line bg-cream-light p-5">
        <div className="flex items-center gap-3"><Database className="h-5 w-5 text-gold-deep"/><h2 className="font-semibold text-navy">Respaldo diario cifrado</h2></div>
        {!backup ? <p className="mt-3 text-sm text-ink-soft">El primer respaldo se generará automáticamente.</p> : <div className="mt-3 text-sm text-ink-soft"><p className="font-semibold text-navy">{backup.status === "completed" ? "Completado correctamente" : backup.status === "running" ? "En proceso" : "Falló"}</p><p>{date(backup.completed_at ?? backup.started_at)}</p>{backup.status === "completed" ? <p>{backup.table_count} tablas · {backup.row_count.toLocaleString("es-MX")} registros · {Math.round(Number(backup.size_bytes ?? 0) / 1024).toLocaleString("es-MX")} KB</p> : null}{backup.error_message ? <p className="mt-2 text-red-700">{backup.error_message}</p> : null}</div>}
      </div>
      <div className="border border-line bg-cream-light p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-gold-deep"/><h2 className="font-semibold text-navy">Protección activa</h2></div><p className="mt-3 text-sm text-ink-soft">Los respaldos se cifran antes de salir del servidor, se guardan en el almacenamiento privado y se conservan durante 30 días.</p></div>
    </section>
    <section><div className="mb-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-gold-deep"/><h2 className="font-serif text-3xl text-navy">Alertas abiertas</h2></div>
      {!alertsResult.rowCount ? <div className="flex items-center gap-3 border border-green-200 bg-green-50 p-5 text-green-800"><CheckCircle2 className="h-5 w-5"/>No hay fallas pendientes.</div> : <div className="space-y-3">{alertsResult.rows.map((alert) => {
        const paymentId = typeof alert.context?.payment_id === "string" ? alert.context.payment_id : "";
        const detail = reservationDetails.get(paymentId);
        return <article key={alert.id} className={`border p-5 ${alert.severity === "critical" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">{alert.severity === "critical" ? "Crítica" : "Advertencia"} · {alert.category}</div><h3 className="mt-1 font-semibold text-navy">{alert.title}</h3><p className="mt-2 max-w-3xl text-sm text-ink-soft">{alert.message}</p>{detail ? <div className="mt-3 border-l-2 border-red-300 pl-3 text-sm text-navy"><p><strong>Persona:</strong> {detail.name} · {detail.email}</p><p><strong>Asientos originales:</strong> {detail.seats.join(", ")}</p></div> : null}<p className="mt-2 text-xs text-ink-soft">Última vez: {date(alert.last_occurred_at)} · {alert.occurrence_count} ocurrencia(s)</p>{alert.email_delivery_error ? <p className="mt-1 text-xs text-red-700">También falló el aviso por correo.</p> : null}</div><form method="POST" action="/api/admin/control/resolve"><input type="hidden" name="alert_id" value={alert.id}/><button className="border border-navy px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-navy hover:text-white">Marcar resuelta</button></form></div></article>;
      })}</div>}
    </section>
    <section><h2 className="mb-4 font-serif text-3xl text-navy">Bitácora financiera</h2><div className="overflow-x-auto border border-line bg-white"><table className="w-full min-w-[850px] text-sm"><thead className="bg-navy text-cream"><tr>{["Fecha", "Acción", "Responsable", "Cuenta", "Referencia"].map((item) => <th key={item} className="px-4 py-3 text-left text-xs uppercase tracking-wider">{item}</th>)}</tr></thead><tbody className="divide-y divide-line-soft">{auditResult.rows.map((entry) => <tr key={entry.id}><td className="whitespace-nowrap px-4 py-3 text-ink-soft">{date(entry.created_at)}</td><td className="px-4 py-3 font-semibold text-navy">{actionLabels[entry.action] ?? entry.action}</td><td className="px-4 py-3">{entry.actor_name || entry.actor_email || "Sistema automático"}</td><td className="px-4 py-3">{entry.account_name || "—"}</td><td className="max-w-[250px] break-all px-4 py-3 font-mono text-xs text-ink-soft">{entry.entity_id || "—"}</td></tr>)}{!auditResult.rowCount ? <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Aún no hay movimientos registrados en la nueva bitácora.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
