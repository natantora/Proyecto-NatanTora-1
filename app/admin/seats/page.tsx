import { createAdminClient } from "@/lib/data/server";
import SeatsAdmin from "./SeatsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminSeatsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("seats").select("*").order("row_label", { ascending: true }).order("seat_number", { ascending: true });
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-midrash-900">Gestión de asientos</h1>
      <SeatsAdmin seats={data ?? []} />
    </div>
  );
}
