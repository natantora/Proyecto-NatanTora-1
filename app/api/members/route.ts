import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageMembers, type Role } from "@/lib/permissions";
import { transaction } from "@/lib/db";
import {
  ensureMemberStatusAuditSchemaWithClient,
  recordMemberStatusChange,
  type MemberStatus,
} from "@/lib/member-status-audit";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || !canManageMembers(user.role as Role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const result = await transaction(async (client) => {
      await ensureMemberStatusAuditSchemaWithClient(client);
      const currentResult = await client.query<{ status: MemberStatus }>(
        "SELECT status FROM profiles WHERE id = $1 FOR UPDATE",
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) return { found: false };
      if (current.status === status) return { found: true, changed: false };

      await client.query(
        "UPDATE profiles SET status = $2, updated_at = NOW() WHERE id = $1",
        [id, status],
      );
      await recordMemberStatusChange(client, {
        profileId: id,
        previousStatus: current.status,
        newStatus: status as MemberStatus,
        changedBy: user.id,
        source: "admin_panel",
      });
      return { found: true, changed: true, statusChangedAt: new Date().toISOString() };
    });
    if (!result.found) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      changed: result.changed,
      status_changed_at: result.changed ? result.statusChangedAt : undefined,
      status_changed_by_name: user.full_name || user.email,
      status_change_source: "admin_panel",
    });
  } catch (error) {
    console.error("[api/members] profile update failed:", error);
    return NextResponse.json({ error: "No se pudo actualizar el miembro" }, { status: 500 });
  }
}
