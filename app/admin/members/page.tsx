import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canManageMembers, type Role } from "@/lib/permissions";
import MembersList from "./MembersList";
import RolePermissionsMatrix from "@/components/admin/RolePermissionsMatrix";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/members");

  const role = await getUserRole(user.id);
  if (!canManageMembers(role)) redirect("/admin/dashboard?error=no_access");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, status, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <div>
        <div className="eyebrow eyebrow-line text-gold mb-4">Comunidad</div>
        <h1 className="serif-display text-navy">
          Miembros del <em>Midrash</em>
        </h1>
        <p className="text-[14px] text-ink-soft mt-3 max-w-2xl leading-relaxed">
          Aprueba o rechaza solicitudes de nuevos miembros. Asigna roles
          (Rabino, Editor, Administrador) a quienes colaboren con el Midrash.
          Toca <em>&quot;Ver permisos&quot;</em> al lado de cada miembro para revisar
          exactamente qué puede hacer.
        </p>
      </div>

      <RolePermissionsMatrix defaultOpen={false} />

      <MembersList
        members={data ?? []}
        currentUserRole={role as Role}
        currentUserId={user.id}
      />
    </div>
  );
}
