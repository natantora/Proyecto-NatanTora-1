import { NextResponse, type NextRequest } from "next/server";
import { consumeToken } from "@/lib/approval-tokens";
import { getCurrentUser } from "@/lib/auth";
import { canManageMembers, type Role } from "@/lib/permissions";
import { query } from "@/lib/db";
import { sendMemberDecisionEmail } from "@/lib/transactional-emails";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión como administrador." }, { status: 401 });
  }
  if (user.status !== "approved" || !canManageMembers(user.role as Role)) {
    return NextResponse.json({ error: "No tienes permiso para gestionar miembros." }, { status: 403 });
  }

  const { token } = await params;
  const result = await consumeToken(token, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const profile = await query<{ email: string | null; full_name: string | null }>(
    "SELECT email, full_name FROM profiles WHERE id = $1",
    [result.userId],
  );
  const target = profile.rows[0];
  if (target?.email) {
    await sendMemberDecisionEmail({
      email: target.email,
      memberName: target.full_name || target.email,
      status: result.action === "approve" ? "approved" : "rejected",
    }).catch((emailError) => console.error("[api/approve] decision email failed:", emailError));
  }
  return NextResponse.json({ ok: true, action: result.action });
}
