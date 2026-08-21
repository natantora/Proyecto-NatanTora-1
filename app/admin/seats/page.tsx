import { redirect } from "next/navigation";
import { createClient } from "@/lib/data/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canManageSeats } from "@/lib/permissions";
import { getVenueLayout } from "@/lib/venue-layout";
import VenueLayoutEditor from "./VenueLayoutEditor";

export const dynamic = "force-dynamic";

export default async function AdminSeatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = await getUserRole(user?.id);
  if (!canManageSeats(role)) redirect("/admin/dashboard");

  const layout = await getVenueLayout();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-bold text-midrash-900">Mapa de asientos</h1>
        <p className="mt-1 text-sm text-midrash-600">
          Arma el plano real del salón con sillas y mesas. Este es el plano que se usa para generar los
          asientos de cualquier evento con reservación &ldquo;Con plano&rdquo;.
        </p>
      </div>
      <VenueLayoutEditor initialTables={layout.tables} initialSeats={layout.seats} />
    </div>
  );
}
