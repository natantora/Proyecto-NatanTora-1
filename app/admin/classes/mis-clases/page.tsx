import { redirect } from "next/navigation";
import ClassesAdmin from "../ClassesAdmin";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import {
  canCreateOwnClasses,
  canPublishDirectly,
  canEditAllClasses,
  type Role,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MisClasesPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/classes/mis-clases");
  const role = (await getUserRole(user.id)) as Role;
  if (!canCreateOwnClasses(role)) redirect("/admin/dashboard?error=no_access");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <div>
        <div className="eyebrow eyebrow-line text-gold mb-4">Mis aportes</div>
        <h1 className="serif-display text-navy">
          Mis <em>clases</em>
        </h1>
        <p className="text-[14px] text-ink-soft mt-3 max-w-2xl leading-relaxed">
          Sube grabaciones, escritos o videos de tus clases. Cada clase nueva
          pasa por una revisión breve del admin antes de publicarse en la
          biblioteca pública del Midrash.
        </p>
      </div>
      <ClassesAdmin
        initialClasses={(data ?? []) as any}
        currentUserId={user.id}
        currentUserRole={role}
        canPublishDirect={canPublishDirectly(role)}
        canEditAll={canEditAllClasses(role)}
      />
    </div>
  );
}
