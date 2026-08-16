import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageSeats, type Role } from "@/lib/permissions";

async function isAuthorized() {
  const user = await getCurrentUser();
  return !!user && user.status === "approved" && canManageSeats(user.role as Role);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id, status, holder_name, holder_email, holder_phone } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (status) {
    if (!["available", "reserved", "taken"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    updates.status = status;
    if (status === "available") {
      updates.holder_name = null; updates.holder_email = null; updates.holder_phone = null; updates.reserved_at = null;
    }
  }
  if (holder_name !== undefined) updates.holder_name = holder_name;
  if (holder_email !== undefined) updates.holder_email = holder_email;
  if (holder_phone !== undefined) updates.holder_phone = holder_phone;
  const supabase = createAdminClient();
  const { error } = await supabase.from("seats").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
