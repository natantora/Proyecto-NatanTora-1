import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canReviewClasses, type Role } from "@/lib/permissions";
import PendingReviewList from "./PendingReviewList";

export const dynamic = "force-dynamic";

export default async function PendingReviewPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/classes/pending");
  const role = (await getUserRole(user.id)) as Role;
  if (!canReviewClasses(role)) redirect("/admin/dashboard?error=no_access");

  const supabase = createAdminClient();
  const { data: pending } = await supabase
    .from("classes")
    .select("id, title, description, category, media_type, media_url, rabbi, duration_minutes, owner_id, created_at, rejection_reason")
    .eq("pending_review", true)
    .order("created_at", { ascending: true });

  // Cargar nombres de los rabinos (owner_id → profile.full_name)
  const ownerIds = Array.from(new Set((pending ?? []).map((c) => c.owner_id).filter(Boolean) as string[]));
  let ownerMap: Record<string, { name: string; email: string }> = {};
  if (ownerIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ownerIds);
    for (const p of profs ?? []) {
      ownerMap[p.id] = { name: p.full_name || "(sin nombre)", email: p.email || "" };
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="eyebrow eyebrow-line text-gold mb-4">Cola de revisión</div>
        <h1 className="serif-display text-navy">
          Clases <em>pendientes</em>
        </h1>
        <p className="text-[14px] text-ink-soft mt-3 max-w-2xl leading-relaxed">
          Clases enviadas por rabinos esperando aprobación. Revisa el
          contenido, publica si está listo o devuelve con un comentario.
        </p>
      </div>
      <PendingReviewList items={(pending ?? []) as any} owners={ownerMap} />
    </div>
  );
}
