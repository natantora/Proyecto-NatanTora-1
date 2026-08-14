import { createAdminClient } from "@/lib/supabase/server";
import EventsAdmin from "./EventsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold text-midrash-900">Eventos</h1>
      <EventsAdmin initial={data ?? []} />
    </div>
  );
}
