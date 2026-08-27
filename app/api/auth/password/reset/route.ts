import { NextResponse, type NextRequest } from "next/server";
import { resetPassword } from "@/lib/password-reset";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (isRateLimited(`password-reset-submit:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Solicita un enlace nuevo más tarde." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");
  if (!token) return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "La contraseña es demasiado larga." }, { status: 400 });
  }

  try {
    const result = await resetPassword(token, password);
    if (result !== "ok") {
      return NextResponse.json({ error: "Este enlace no es válido, ya fue usado o venció. Solicita uno nuevo." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/password/reset]", error);
    return NextResponse.json({ error: "No se pudo cambiar la contraseña. Inténtalo nuevamente." }, { status: 500 });
  }
}
