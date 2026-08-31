import { redirect } from "next/navigation";
import { Armchair, CircleDollarSign, Gift, ReceiptText } from "lucide-react";
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
};

const kindLabel: Record<string, string> = { billing: "Estado de cuenta", donation: "Donativo", event: "Evento" };
const statusLabel: Record<string, string> = { paid: "Pagado", pending: "Pendiente", failed: "Fallido", refunded: "Reembolsado" };

export default async function AdminPaymentsPage() {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canManagePayments(user.role as Role)) redirect("/admin/dashboard");
  const result = await query<PaymentRow>(
    `SELECT payment.id, payment.amount::text, payment.currency, payment.status,
            payment.payment_method, payment.donor_name, payment.donor_email,
            payment.description, payment.metadata, payment.stripe_payment_intent,
            payment.stripe_subscription_id, payment.paid_at, payment.created_at, payment.billing_account_id,
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

  return <div className="space-y-6">
    <div><h1 className="font-serif text-3xl font-bold text-midrash-900">Pagos</h1><p className="mt-1 text-sm text-midrash-600">Historial unificado de estados de cuenta, donativos y reservaciones de eventos.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={CircleDollarSign} label="Ingresos confirmados" value={formatMXN(totalPaid)} />
      <Stat icon={Gift} label="Donativos recibidos" value={formatMXN(donations)} />
      <Stat icon={Armchair} label="Ingresos por eventos" value={formatMXN(eventRevenue)} />
      <Stat icon={ReceiptText} label="Operaciones pendientes" value={String(pendingCount)} />
    </div>
    <div className="overflow-x-auto rounded-xl border border-midrash-100 bg-white">
      <table className="w-full min-w-[1120px] divide-y divide-midrash-100 text-sm">
        <thead className="bg-midrash-50"><tr>{["Fecha", "Tipo", "Persona", "Concepto", "Método", "Monto", "Estado", "Referencia"].map((label) => <th key={label} className={`px-4 py-3 text-xs font-semibold uppercase text-midrash-600 ${label === "Monto" ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-midrash-100">
          {!payments.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-midrash-500">Todavía no hay movimientos.</td></tr> : null}
          {payments.map((payment) => {
            const kind = typeof payment.metadata?.kind === "string" ? payment.metadata.kind : payment.billing_account_id ? "billing" : "donation";
            const moment = new Date(payment.paid_at ?? payment.created_at);
            const reference = payment.stripe_payment_intent || payment.stripe_subscription_id || payment.id;
            return <tr key={payment.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-midrash-600"><div>{moment.toLocaleDateString("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" })}</div><div className="text-xs text-midrash-400">{moment.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}</div></td>
              <td className="px-4 py-3"><div className="font-semibold text-navy">{kindLabel[kind] ?? "Pago"}</div>{payment.metadata?.frequency === "monthly" ? <div className="text-xs text-gold-deep">Mensual</div> : null}</td>
              <td className="px-4 py-3"><div className="font-medium text-midrash-900">{payment.account_name || payment.donor_name || "—"}</div><div className="max-w-[220px] break-all text-xs text-midrash-500">{payment.donor_email ?? ""}</div></td>
              <td className="max-w-[280px] px-4 py-3 text-midrash-700">{payment.event_title || payment.description || (kind === "donation" ? "Apoyo general" : "Pago")}</td>
              <td className="px-4 py-3 text-midrash-600">{payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "stripe" ? "Stripe" : payment.payment_method || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-navy">{formatMXN(Number(payment.amount))}</td>
              <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", payment.status === "paid" ? "bg-green-100 text-green-800" : payment.status === "pending" ? "bg-amber-100 text-amber-800" : payment.status === "refunded" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800")}>{statusLabel[payment.status] ?? payment.status}</span></td>
              <td className="px-4 py-3"><span title={reference} className="block max-w-[170px] truncate font-mono text-[11px] text-midrash-500">{reference}</span></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return <div className="rounded-xl border border-midrash-100 bg-white p-4"><Icon className="h-5 w-5 text-gold-deep" /><div className="mt-3 font-serif text-2xl font-bold text-navy">{value}</div><div className="text-xs text-midrash-500">{label}</div></div>;
}
