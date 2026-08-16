import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import {
  canAssignRole,
  isValidRole,
  type Role,
} from "@/lib/permissions";

/**
 * POST /api/admin/promote
 * Body: { id: string, role: "member" | "rabino" | "editor" | "admin" }
 *
 * Solo los owners pueden cambiar roles. La asignación de "owner" no se
 * permite por API; solo se hace por SQL inicial (medida de seguridad
 * contra escalación accidental).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const actorRole = await getUserRole(user.id);
  if (actorRole !== "owner") {
    return NextResponse.json(
      { error: "Solo los propietarios pueden cambiar roles." },
      { status: 403 }
    );
  }

  const { id, role } = await req.json().catch(() => ({}));
  if (!id || !isValidRole(role)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!canAssignRole(actorRole, role as Role)) {
    return NextResponse.json(
      { error: "No tienes permiso para asignar ese rol" },
      { status: 403 }
    );
  }

  // No tocar al target si ya es owner
  const adminCli = createAdminClient();
  const { data: target } = await adminCli
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (target?.role === "owner") {
    return NextResponse.json(
      { error: "No se puede modificar el rol de un Propietario desde el panel" },
      { status: 403 }
    );
  }

  // Self-protection: si yo soy el único con privilegios elevados, no me bajo
  if (id === user.id && role === "member") {
    const { count } = await adminCli
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "owner"]);
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "No puedes bajarte el rol siendo el único administrador/propietario" },
        { status: 400 }
      );
    }
  }

  const updates: { role: Role; status?: string } = { role: role as Role };
  // Asignar un rol con privilegios implica aprobar al usuario
  if (role !== "member") updates.status = "approved";

  const { error } = await adminCli.from("profiles").update(updates).eq("id", id);
  if (error) {
    console.error("[api/admin/promote] update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
