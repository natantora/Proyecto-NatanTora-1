import { createAdminClient } from "@/lib/data/server";
import { canAccessAdminPanel, type Role } from "@/lib/permissions";

/**
 * Si no existe ningún admin/owner en `profiles`, promueve al usuario
 * indicado a admin y lo aprueba automáticamente.
 *
 * Resuelve el "huevo y la gallina" del primer admin del Midrash: la
 * primera persona que se registra recibe acceso completo. Una vez existe
 * al menos un admin/owner, los siguientes siguen el flujo normal.
 */
export async function bootstrapAdminIfFirstUser(
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();

  // ¿Existe ya alguien con privilegios admin u owner?
  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "owner"]);

  if (countError) {
    console.error("[bootstrap] error contando admins/owners:", countError);
    return false;
  }
  if ((count ?? 0) > 0) return false;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: "admin", status: "approved" })
    .eq("id", userId);

  if (updateError) {
    console.error("[bootstrap] error promoviendo primer admin:", updateError);
    return false;
  }

  console.log("[bootstrap] usuario", userId, "promovido a admin (primer user)");
  return true;
}

/**
 * Lee el role del usuario desde profiles. Devuelve null si no existe.
 */
export async function getUserRole(
  userId: string | null | undefined
): Promise<Role | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as Role) ?? null;
}

/**
 * ¿El usuario tiene acceso al panel /admin/* ?
 * (cualquier rol distinto de member: rabino, editor, admin, owner)
 */
export async function isUserAdmin(
  userId: string | null | undefined
): Promise<boolean> {
  const role = await getUserRole(userId);
  return canAccessAdminPanel(role);
}
