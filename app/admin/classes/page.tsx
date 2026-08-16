import { redirect } from "next/navigation";
import ClassesAdmin from "./ClassesAdmin";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import {
  canCreateOwnClasses,
  canEditAllClasses,
  canPublishDirectly,
  type Role,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/classes");
  const role = (await getUserRole(user.id)) as Role;

  if (!canCreateOwnClasses(role)) redirect("/admin/dashboard?error=no_access");

  // Rabinos van a su vista filtrada
  if (role === "rabino") redirect("/admin/classes/mis-clases");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <div>
        <div className="eyebrow eyebrow-line text-gold mb-4">Biblioteca</div>
        <h1 className="serif-display text-navy">
          Clases del <em>Midrash</em>
        </h1>
        <p className="text-[14px] text-ink-soft mt-3 max-w-2xl leading-relaxed">
          Administra el catálogo completo de clases. Puedes publicar, despublicar
          o editar cualquier clase, incluso las subidas por rabinos.
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
