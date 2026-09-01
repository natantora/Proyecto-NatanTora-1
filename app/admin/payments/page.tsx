import { redirect } from "next/navigation";
import { AlertTriangle, Armchair, CircleDollarSign, Gift, ReceiptText, RotateCcw } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canManagePayments, type Role } from "@/lib/permissions";
import { cn, formatMXN } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string; amount: string; currency: string; status: string; payment_method: string | null;
  donor_name: string | null; donor_email: string | null; description: string | null;
  metadata: Record<string, unknown> | null; stripe_payment_intent: string | null;
  stripe_subscription_id: string | null; paid_at: Date | null; created_at: Date;
  billing_account_id: string | null; account_name: string | null; event_title: string | null;
  mercadopago_payment_id: string | null; mercadopago_preference_id: string | null;
  provider_status: string | null; provider_status_detail: string | null; provider_updated_at: Date | null;
};

const kindLabel: Record<string, string> = { billing: "Estado de cuenta", donation: "Donativo", event: "Evento" };
const statusLabel: Record<string, string> = { paid: "Aprobado", pending: "Pendiente", failed: "Fallido", refunded: "Reembolsado", charged_back: "Contracargo" };
const providerStatusLabel: Record<string, string> = {
  approved: "Aprobado", pending: "Pendiente", in_process: "En proceso", authorized: "Autorizado",
  rejected: "Rechazado", cancelled: "Cancelado", refunded: "Reembolsado", charged_back: "Contracargo",
};

function localStatus(payment: PaymentRow): string {
  if (payment.status === "failed" && payment.provider_status === "rejected") return "Rechazado";
  if (payment.status === "failed" && payment.provider_status === "cancelled") return "Cancelado";
  if (payment.status === "failed") return "Vencido / fallido";
  return statusLabel[payment.status] ?? payment.status;
}

function statusColor(status: string): string {
  if (status === "paid" || status === "approved") return "bg-green-100 text-green-800";
  if (["pending", "in_process", "authorized"].includes(status)) return "bg-amber-100 text-amber-800";
  if (status === "refunded") return "bg-blue-100 text-blue-800";
  if (status === "charged_back") return "bg-purple-100 text-purple-800";
  return "bg-red-100 text-red-800";
}

export default async function AdminPaymentsPage() {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canManagePayments(user.role as Role)) redirect("/admin/dashboard");
  const result = await query<PaymentRow>(
    `SELECT payment.id, payment.amount::text, payment.currency, payment.status,
            payment.payment_method, payment.donor_name, payment.donor_email,
            payment.description, payment.metadata, payment.stripe_payment_intent,
            payment.stripe_subscription_id, payment.paid_at, payment.created_at, payment.billing_account_id,
            payment.mercadopago_payment_id, payment.mercadopago_preference_id,
            payment.provider_status, payment.provider_status_detail, payment.provider_updated_at,
            account.display_name AS account_name, event.title AS event_title
       FROM payments payment
  LEFT JOIN billing_accounts account ON account.id = payment.billing_account_id
  LEFT JOIN events event ON event.id::text = payment.metadata->>'event_id'
   ORDER BY payment.created_at DESC LIMIT 500`,
  );
  const payments = result.rows;
  const paid = payments.filter((payment) => payment.status === "paid");
  const totalPaid = paid.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const donations = paid.filter((payment) => payment.metadata?.kind === "donation").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const eventRevenue = paid.filter((payment) => payment.metadata?.kind === "event").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pendingCount = payments.filter((payment) => payment.status === "pending").length;
  const failedCount = payments.filter((payment) => payment.status === "failed").length;
  const reversalCount = payments.filter((payment) => payment.status === "refunded" || payment.status === "charged_back").length;

  return <div className="space-y-6">
    <div><h1 className="font-serif text-3xl font-bold text-midrash-900">Pagos</h1><p className="mt-1 text-sm text-midrash-600">Historial unificado de estados de cuenta, donativos y reservaciones de eventos.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <Stat icon={CircleDollarSign} label="Ingresos confirmados" value={formatMXN(totalPaid)} />
      <Stat icon={Gift} label="Donativos recibidos" value={formatMXN(donations)} />
      <Stat icon={Armchair} label="Ingresos por eventos" value={formatMXN(eventRevenue)} />
      <Stat icon={ReceiptText} label="Operaciones pendientes" value={String(pendingCount)} />
      <Stat icon={AlertTriangle} label="No completados" value={String(failedCount)} />
      <Stat icon={RotateCcw} label="Reembolsos / contracargos" value={String(reversalCount)} />
    </div>
    <div className="space-y-3 xl:hidden">
      {!payments.length ? <div className="rounded-xl border border-midrash-100 bg-white px-4 py-10 text-center text-midrash-500">Todavía no hay movimientos.</div> : null}
      {payments.map((payment) => {
        const kind = typeof payment.metadata?.kind === "string" ? payment.metadata.kind : payment.billing_account_id ? "billing" : "donation";
        const moment = new Date(payment.paid_at ?? payment.created_at);
        return <article key={payment.id} className="rounded-xl border border-midrash-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-midrash-400">Resultado del pago</div><div className="mt-1"><PaymentStatusBadge payment={payment} /></div></div>
            <div className="text-right"><div className="text-lg font-bold text-navy">{formatMXN(Number(payment.amount))}</div><div className="text-[10px] text-midrash-400">{moment.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" })}</div></div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-midrash-100 pt-4 sm:grid-cols-2">
            <div><div className="font-semibold text-navy">{payment.account_name || payment.donor_name || "Sin nombre"}</div><div className="break-all text-xs text-midrash-500">{payment.donor_email || "Sin correo"}</div></div>
            <div><div className="text-[10px] font-semibold uppercase tracking-wide text-midrash-400">{kindLabel[kind] ?? "Pago"}</div><div className="text-sm text-midrash-700">{payment.event_title || payment.description || "Pago"}</div></div>
            <div><div className="text-[10px] font-semibold uppercase tracking-wide text-midrash-400">Mercado Pago</div><ProviderStatusInfo payment={payment} /></div>
            <div><div className="text-[10px] font-semibold uppercase tracking-wide text-midrash-400">Referencias</div><PaymentReferences payment={payment} /></div>
          </div>
        </article>;
      })}
    </div>
    <div className="hidden overflow-x-auto rounded-xl border border-midrash-100 bg-white xl:block">
      <table className="w-full min-w-[1380px] divide-y divide-midrash-100 text-sm">
        <thead className="bg-midrash-50"><tr>{["Fecha", "Resultado", "Persona", "Concepto", "Monto", "Estado de Mercado Pago", "Método", "Referencias"].map((label) => <th key={label} className={`px-4 py-3 text-xs font-semibold uppercase text-midrash-600 ${label === "Monto" ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-midrash-100">
          {!payments.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-midrash-500">Todavía no hay movimientos.</td></tr> : null}
          {payments.map((payment) => {
            const kind = typeof payment.metadata?.kind === "string" ? payment.metadata.kind : payment.billing_account_id ? "billing" : "donation";
            const moment = new Date(payment.paid_at ?? payment.created_at);
            return <tr key={payment.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-midrash-600"><div>{moment.toLocaleDateString("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" })}</div><div className="text-xs text-midrash-400">{moment.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}</div></td>
              <td className="px-4 py-3"><PaymentStatusBadge payment={payment} /></td>
              <td className="px-4 py-3"><div className="font-medium text-midrash-900">{payment.account_name || payment.donor_name || "—"}</div><div className="max-w-[220px] break-all text-xs text-midrash-500">{payment.donor_email ?? ""}</div></td>
              <td className="max-w-[280px] px-4 py-3 text-midrash-700"><div className="font-semibold text-navy">{kindLabel[kind] ?? "Pago"}</div><div>{payment.event_title || payment.description || (kind === "donation" ? "Apoyo general" : "Pago")}</div>{payment.metadata?.frequency === "monthly" ? <div className="text-xs text-gold-deep">Mensual</div> : null}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-navy">{formatMXN(Number(payment.amount))}</td>
              <td className="px-4 py-3"><ProviderStatusInfo payment={payment} /></td>
              <td className="px-4 py-3 text-midrash-600">{payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "mercadopago" ? "Mercado Pago" : payment.payment_method === "stripe" ? "Stripe" : payment.payment_method || "—"}</td>
              <td className="px-4 py-3"><PaymentReferences payment={payment} /></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

function PaymentStatusBadge({ payment }: { payment: PaymentRow }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusColor(payment.status))}>{localStatus(payment)}</span>;
}

function ProviderStatusInfo({ payment }: { payment: PaymentRow }) {
  return <div>
    {payment.provider_status ? <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusColor(payment.provider_status))}>{providerStatusLabel[payment.provider_status] ?? payment.provider_status}</span> : <span className="text-xs text-midrash-400">Sin respuesta del proveedor</span>}
    {payment.provider_status_detail ? <div title={payment.provider_status_detail} className="mt-1 max-w-[220px] truncate font-mono text-[10px] text-midrash-500">{payment.provider_status_detail}</div> : null}
    {payment.provider_updated_at ? <div className="mt-1 text-[10px] text-midrash-400">Actualizado {new Date(payment.provider_updated_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" })}</div> : null}
  </div>;
}

function PaymentReferences({ payment }: { payment: PaymentRow }) {
  return <div className="font-mono text-[10px] text-midrash-500">
    {payment.mercadopago_payment_id ? <Reference label="Pago MP" value={payment.mercadopago_payment_id} /> : null}
    {payment.mercadopago_preference_id ? <Reference label="Preferencia" value={payment.mercadopago_preference_id} /> : null}
    {payment.stripe_payment_intent ? <Reference label="Pago Stripe" value={payment.stripe_payment_intent} /> : null}
    {payment.stripe_subscription_id ? <Reference label="Suscripción" value={payment.stripe_subscription_id} /> : null}
    <Reference label="Interno" value={payment.id} />
  </div>;
}

function Reference({ label, value }: { label: string; value: string }) {
  return <div className="mb-1 max-w-[230px]" title={value}><span className="font-sans text-[9px] font-semibold uppercase tracking-wide text-midrash-400">{label}: </span><span className="break-all">{value}</span></div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return <div className="rounded-xl border border-midrash-100 bg-white p-4"><Icon className="h-5 w-5 text-gold-deep" /><div className="mt-3 font-serif text-2xl font-bold text-navy">{value}</div><div className="text-xs text-midrash-500">{label}</div></div>;
}
