const RESEND_API = "https://api.resend.com/emails";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Envia un email via Resend. Falla silenciosamente (con log) si
 * RESEND_API_KEY no esta configurado, de modo que el flujo principal
 * no se rompe en desarrollo o si el admin no termino el setup.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Midrash Natán Torá <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurada, skip email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", res.status, err);
      return { ok: false, error: err };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] fetch failed:", e);
    return { ok: false, error: String(e) };
  }
}
