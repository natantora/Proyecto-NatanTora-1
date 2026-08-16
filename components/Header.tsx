import { createClient } from "@/lib/supabase/server";
import { canAccessAdminPanel, type Role } from "@/lib/permissions";
import HeaderClient from "./HeaderClient";

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let approved = false;
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("id", user.id)
      .maybeSingle();
    approved = profile?.status === "approved";
    // El botón "Admin" se muestra para cualquier rol con acceso al panel:
    // rabino, editor, admin u owner. Solo los 'member' no lo ven.
    isAdmin = canAccessAdminPanel(profile?.role as Role | null | undefined);
  }

  return (
    <HeaderClient isLoggedIn={!!user} approved={approved} isAdmin={isAdmin} />
  );
}
