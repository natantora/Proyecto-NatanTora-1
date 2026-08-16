import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/admin-bootstrap";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isUserAdmin(user.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[api/members] profile update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Confirmar email en auth.users si se aprueba.
  // ROBUSTEZ: si auth.users no existe para este id (caso edge de profiles huérfanos),
  // no fallar — el profile YA quedó actualizado y eso es lo esencial.
  if (status === "approved") {
    try {
      await admin.auth.admin.updateUserById(id, { email_confirm: true });
    } catch (e) {
      console.warn(
        "[api/members] auth.admin.updateUserById fallo (profile actualizado de todos modos):",
        e
      );
    }
  }

  return NextResponse.json({ ok: true });
}
