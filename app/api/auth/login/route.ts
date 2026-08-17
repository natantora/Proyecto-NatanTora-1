import { NextResponse, type NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";

type LoginRow = { id: string; password_hash: string | null; status: string };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const result = await query<LoginRow>(
    "SELECT id, password_hash, status FROM profiles WHERE email = $1 LIMIT 1",
    [email],
  );
  const user = result.rows[0];
  if (!user || !user.password_hash || !(await compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }
  if (user.status !== "approved") {
    return NextResponse.json({ error: user.status === "rejected" ? "Tu solicitud fue rechazada." : "Tu solicitud aún está pendiente de aprobación." }, { status: 403 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
