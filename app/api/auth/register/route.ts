import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bootstrapAdminIfFirstUser } from "@/lib/admin-bootstrap";
import { notifyAdminsOfPending } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.full_name) {
    return NextResponse.json({ error: "Campos incompletos" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: userData, error: authError } =
    await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: { full_name: body.full_name, phone: body.phone },
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = userData.user.id;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: body.full_name,
    email: body.email,
    phone: body.phone,
    status: "pending",
    role: "member",
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Bootstrap: si es el primer user, auto-promover a admin
  const wasBootstrapped = await bootstrapAdminIfFirstUser(userId);

  // Si fue bootstrap, también confirmamos el email automáticamente
  if (wasBootstrapped) {
    await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
  } else {
    // Notificar admins existentes (fire-and-forget)
    notifyAdminsOfPending({
      userId,
      fullName: body.full_name,
      email: body.email,
      phone: body.phone || "",
    }).catch((e) => console.error("[register] notify failed:", e));
  }

  return NextResponse.json({ ok: true, bootstrapped: wasBootstrapped });
}
