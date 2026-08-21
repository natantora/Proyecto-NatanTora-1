import { NextResponse, type NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { transaction } from "@/lib/db";
import { notifyAdminsOfPending } from "@/lib/notifications";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (isRateLimited(`register:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes de registro. Intenta de nuevo más tarde." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const fullName = String(body?.full_name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

  if (!email || !fullName || password.length < 8) {
    return NextResponse.json(
      { error: "Completa los campos; la contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hash(password, 12);
    const initialOwner = (process.env.INITIAL_OWNER_EMAIL ?? "").trim().toLowerCase();
    const user = await transaction(async (client) => {
      const existing = await client.query("SELECT id FROM profiles WHERE email = $1", [email]);
      if (existing.rowCount) throw new Error("EMAIL_EXISTS");
      const count = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM profiles");
      const first = Number(count.rows[0]?.count ?? 0) === 0;
      const owner = first && initialOwner !== "" && email === initialOwner;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO profiles (full_name, email, phone, password_hash, status, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [fullName, email, phone || null, passwordHash, owner ? "approved" : "pending", owner ? "owner" : "member"],
      );
      return { id: inserted.rows[0].id, owner };
    });

    if (!user.owner) {
      notifyAdminsOfPending({ userId: user.id, fullName, email, phone }).catch(console.error);
    }
    return NextResponse.json({ ok: true, owner: user.owner });
  } catch (error: any) {
    if (error?.message === "EMAIL_EXISTS" || error?.code === "23505") {
      return NextResponse.json({ error: "Ese correo ya está registrado." }, { status: 409 });
    }
    console.error("[register]", error);
    return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
  }
}
