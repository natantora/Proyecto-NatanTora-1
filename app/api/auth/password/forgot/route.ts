import { NextResponse, type NextRequest } from "next/server";
import { createPasswordResetToken } from "@/lib/password-reset";
import { passwordResetEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site-url";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

const GENERIC_MESSAGE = "Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  if (
    isRateLimited(`password-reset-ip:${clientIp(req)}`, 5, 60 * 60 * 1000) ||
    isRateLimited(`password-reset-email:${email}`, 3, 60 * 60 * 1000)
  ) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  try {
    const reset = await createPasswordResetToken(email);
    if (reset) {
      const resetUrl = `${siteOrigin()}/auth/restablecer?token=${encodeURIComponent(reset.token)}`;
      await sendEmail({
        to: reset.email,
        subject: "Restablece tu contraseña — Natán Torá",
        html: passwordResetEmail({ memberName: reset.memberName, resetUrl }),
        text: `Usa este enlace para crear una contraseña nueva. Vence en 30 minutos y solo funciona una vez: ${resetUrl}\n\nSi no solicitaste el cambio, ignora este mensaje.`,
      });
    }
  } catch (error) {
    console.error("[auth/password/forgot]", error);
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
