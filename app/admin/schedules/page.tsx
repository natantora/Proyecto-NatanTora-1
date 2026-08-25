import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import { canEditHorarios, type Role } from "@/lib/permissions";
import SchedulesAdmin, { type ScheduleRow } from "./SchedulesAdmin";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canEditHorarios(user.role as Role)) redirect("/admin/dashboard?error=no_access");
  const { data } = await createAdminClient().from("schedules").select("*").eq("kind", "rezo").order("position");

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow eyebrow-line mb-4 text-gold">Tefilot</div>
        <h1 className="serif-display text-navy">Horarios del <em>Midrash</em></h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">Administra los horarios fijos y los que se calculan automáticamente con relación al shkiá de Ciudad de México.</p>
      </div>
      <SchedulesAdmin initial={(data ?? []) as ScheduleRow[]} />
    </div>
  );
}
