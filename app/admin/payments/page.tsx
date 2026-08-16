import { createAdminClient } from "@/lib/data/server";
import { formatMXN, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PaymentRow = { id: string; amount: number | null; currency: string | null; status: string | null; payment_method: string | null; donor_name: string | null; donor_email: string | null; description: string | null; created_at: string | null; };

export default async function AdminPaymentsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200);
  const payments = (data ?? []) as PaymentRow[];
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0);
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-midrash-900">Pagos</h1>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-50 p-4 text-center"><div className="font-serif text-2xl font-bold text-green-700">{formatMXN(totalPaid)}</div><div className="text-xs text-green-600">Recaudado</div></div>
        <div className="rounded-lg bg-yellow-50 p-4 text-center"><div className="font-serif text-2xl font-bold text-yellow-700">{pendingCount}</div><div className="text-xs text-yellow-600">Pendientes</div></div>
        <div className="rounded-lg bg-midrash-50 p-4 text-center"><div className="font-serif text-2xl font-bold text-midrash-800">{payments.length}</div><div className="text-xs text-midrash-600">Total registros</div></div>
      </div>
      <div className="overflow-hidden rounded-xl border border-midrash-100 bg-white">
        <table className="min-w-full divide-y divide-midrash-100">
          <thead className="bg-midrash-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Fecha</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Donante</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Concepto</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Método</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Monto</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Estado</th></tr></thead>
          <tbody className="divide-y divide-midrash-100">
            {payments.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-midrash-500">Sin pagos aún.</td></tr>)}
            {payments.map((p) => (<tr key={p.id}>
              <td className="px-4 py-3 text-sm">{p.created_at ? new Date(p.created_at).toLocaleDateString("es-MX") : ""}</td>
              <td className="px-4 py-3 text-sm"><div className="font-medium text-midrash-900">{p.donor_name ?? "—"}</div><div className="text-xs text-midrash-500">{p.donor_email ?? ""}</div></td>
              <td className="px-4 py-3 text-sm">{p.description ?? "Donativo"}</td>
              <td className="px-4 py-3 text-sm">{p.payment_method ?? "—"}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold">{formatMXN(p.amount ?? 0)}</td>
              <td className="px-4 py-3 text-sm"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", p.status === "paid" ? "bg-green-100 text-green-800" : p.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800")}>{p.status ?? "unknown"}</span></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
