import { createAdminClient } from "@/lib/supabase/server";
import { Users, Armchair, BookOpen, HandCoins } from "lucide-react";
import { formatMXN } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createAdminClient();
  const [members, seats, classes, payments] = await Promise.all([
    supabase.from("profiles").select("id, status", { count: "exact" }),
    supabase.from("seats").select("id, status, tier", { count: "exact" }),
    supabase.from("classes").select("id, published", { count: "exact" }),
    supabase.from("payments").select("amount, status").eq("status", "paid"),
  ]);
  const totalMembers = members.count ?? 0;
  const pendingMembers = members.data?.filter((m) => m.status === "pending").length ?? 0;
  const totalSeats = seats.count ?? 0;
  const takenSeats = seats.data?.filter((s) => s.status !== "available").length ?? 0;
  const publishedClasses = classes.data?.filter((c) => c.published).length ?? 0;
  const totalClasses = classes.count ?? 0;
  const totalRevenue = payments.data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;
  const cards = [
    { label: "Miembros", value: totalMembers, sub: `${pendingMembers} pendientes de aprobación`, icon: Users, color: "bg-midrash-100 text-midrash-800" },
    { label: "Asientos reservados", value: `${takenSeats} / ${totalSeats}`, sub: `${totalSeats - takenSeats} disponibles`, icon: Armchair, color: "bg-gold-100 text-gold-800" },
    { label: "Clases publicadas", value: publishedClasses, sub: `${totalClasses - publishedClasses} en borrador`, icon: BookOpen, color: "bg-green-100 text-green-800" },
    { label: "Ingresos totales", value: formatMXN(totalRevenue), sub: `${payments.data?.length ?? 0} pagos exitosos`, icon: HandCoins, color: "bg-purple-100 text-purple-800" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-midrash-900">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => { const Icon = c.icon; return (<div key={c.label} className="card"><div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}><Icon className="h-5 w-5" /></div><p className="mt-4 text-sm font-medium text-midrash-600">{c.label}</p><p className="mt-1 font-serif text-2xl font-bold text-midrash-900">{c.value}</p><p className="mt-1 text-xs text-midrash-500">{c.sub}</p></div>); })}
      </div>
      <div className="card"><h2 className="font-serif text-lg font-semibold text-midrash-900">Accesos rápidos</h2><p className="mt-1 text-sm text-midrash-600">Desde el menú lateral puedes gestionar miembros, asientos, clases y eventos.</p></div>
    </div>
  );
}
