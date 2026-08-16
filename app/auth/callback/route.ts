import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { bootstrapAdminIfFirstUser } from "@/lib/admin-bootstrap";
import { notifyAdminsOfPending } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=callback`);
  }

  const supabase = await createClient();
  const { error: exchangeError, data } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data?.session) {
    return NextResponse.redirect(`${origin}/auth/login?error=callback`);
  }

  const user = data.session.user;
  const admin = createAdminClient();

  // ¿Ya existe profile?
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, status, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const metadata = user.user_metadata ?? {};
    const fullName =
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "Sin nombre";

    await admin.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      email: user.email ?? "",
      phone: metadata.phone ?? "",
      status: "pending",
      role: "member",
    });

    // Si es el primer user, bootstrap admin
    const wasBootstrapped = await bootstrapAdminIfFirstUser(user.id);
    if (wasBootstrapped) {
      return NextResponse.redirect(`${origin}/admin/dashboard?bootstrap=1`);
    }

    // Notificar a admins (fire-and-forget)
    notifyAdminsOfPending({
      userId: user.id,
      fullName,
      email: user.email ?? "",
      phone: metadata.phone ?? "",
    }).catch((e) => console.error("[callback] notify failed:", e));

    return NextResponse.redirect(`${origin}/auth/pendiente`);
  }

  // Profile existe
  if (["rabino","editor","admin","owner"].includes(existingProfile.role ?? "")) {
    return NextResponse.redirect(`${origin}${next === "/" ? "/admin/dashboard" : next}`);
  }

  if (existingProfile.status !== "approved") {
    return NextResponse.redirect(`${origin}/auth/pendiente`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
