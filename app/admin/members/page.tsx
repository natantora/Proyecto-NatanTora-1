import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/data/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canManageMembers, type Role } from "@/lib/permissions";
import { query } from "@/lib/db";
import { ensureMemberStatusAuditSchema } from "@/lib/member-status-audit";
import MembersList from "./MembersList";
import RolePermissionsMatrix from "@/components/admin/RolePermissionsMatrix";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/members");

  const role = await getUserRole(user.id);
  if (!canManageMembers(role)) redirect("/admin/dashboard?error=no_access");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, status, role, created_at")
    .order("created_at", { ascending: false });

  await ensureMemberStatusAuditSchema();
  const auditResult = await query<{
    profile_id: string;
    status_changed_at: string;
    status_changed_by_name: string;
    status_change_source: string;
  }>(
    `SELECT DISTINCT ON (audit.profile_id)
            audit.profile_id,
            audit.created_at AS status_changed_at,
            COALESCE(actor.full_name, actor.email) AS status_changed_by_name,
            audit.source AS status_change_source
       FROM member_status_audit audit
       JOIN profiles actor ON actor.id = audit.changed_by
      ORDER BY audit.profile_id, audit.created_at DESC`,
  );
  const latestAudit = new Map(auditResult.rows.map((row) => [row.profile_id, row]));
  const members = (data ?? []).map((member: any) => ({
    ...member,
    ...(latestAudit.get(member.id) ?? {}),
  }));

  return (
    <div className="min-w-0 space-y-7 sm:space-y-10">
      <div>
        <div className="eyebrow eyebrow-line text-gold mb-4">Comunidad</div>
        <h1 className="serif-display text-navy text-[38px] sm:text-[48px] leading-[0.98]">
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
        members={members}
        currentUserRole={role as Role}
        currentUserId={user.id}
      />
    </div>
  );
}
