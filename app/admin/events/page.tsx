import { createAdminClient } from "@/lib/data/server";
import { getVenueLayout } from "@/lib/venue-layout";
import { ARCHITECTURAL_SEATS } from "@/lib/architectural-seat-map";
import EventsAdmin from "./EventsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const supabase = createAdminClient();
  const [{ data, error }, layout] = await Promise.all([
    supabase.from("events").select("*").order("event_date", { ascending: false }),
    getVenueLayout(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-midrash-900">Eventos</h1>
      <p className="text-sm text-midrash-600">
        Flujo: crea el borrador, publícalo cuando esté listo y después abre las reservaciones.
      </p>
      {error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No fue posible cargar los eventos. Intenta actualizar la página.
        </div>
      ) : null}
      <EventsAdmin
        initial={data ?? []}
        architecturalSeatCount={ARCHITECTURAL_SEATS.length}
        customSeatCount={layout.seats.length}
      />
    </div>
  );
}
