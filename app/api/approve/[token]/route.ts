import { NextResponse, type NextRequest } from "next/server";
import { consumeToken } from "@/lib/approval-tokens";
import { getCurrentUser } from "@/lib/auth";
import { canManageMembers, type Role } from "@/lib/permissions";

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
  return NextResponse.json({ ok: true, action: result.action });
}
