import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canReviewClasses, type Role } from "@/lib/permissions";

/**
 * POST /api/admin/classes/[id]/review
 * Body: { action: "approve" } | { action: "reject", reason: string }
 *
 * - approve: pending_review=false, published=true, published_at=now,
 *   reviewed_by, reviewed_at, limpia rejection_reason
 * - reject: pending_review=false, published=false, rejection_reason=<reason>,
 *   reviewed_by, reviewed_at
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (await getUserRole(user.id)) as Role | null;
  if (!canReviewClasses(role)) {
    return NextResponse.json({ error: "Sin permisos para revisar clases" }, { status: 403 });
  }

  const { action, reason } = await req.json().catch(() => ({}));
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "Se requiere un comentario para devolver" }, { status: 400 });
  }

  const sb = createAdminClient();
  const now = new Date().toISOString();

  const updates =
    action === "approve"
      ? {
          pending_review: false,
          published: true,
          published_at: now,
          reviewed_by: user.id,
          reviewed_at: now,
          rejection_reason: null,
        }
      : {
          pending_review: false,
          published: false,
          reviewed_by: user.id,
          reviewed_at: now,
          rejection_reason: reason.trim(),
        };

  const { error } = await sb.from("classes").update(updates).eq("id", params.id);
  if (error) {
    console.error("[api/admin/classes/[id]/review] failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
