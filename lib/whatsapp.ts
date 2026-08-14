export interface SendWhatsAppParams {
  to: string; // formato E.164 con o sin "+"
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonUrlParam?: string; // parametro de URL en el primer boton (si la plantilla lo tiene)
}

/**
 * Envia mensaje WhatsApp via Cloud API de Meta.
 * Requiere plantilla previamente aprobada por Meta (Business Manager).
 *
 * Falla silenciosamente si no esta configurado.
 */
export async function sendWhatsApp(
  params: SendWhatsAppParams
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn("[whatsapp] credentials no configuradas, skip");
    return { ok: false, error: "WhatsApp not configured" };
  }

  // Normalizar numero: solo digitos
  const to = params.to.replace(/\D/g, "");
  if (to.length < 10) {
    return { ok: false, error: "Numero de telefono invalido" };
  }

  const components: any[] = [];

  if (params.bodyParams && params.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  if (params.buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: params.buttonUrlParam }],
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode || "es_MX" },
      components: components.length > 0 ? components : undefined,
    },
  };

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[whatsapp] error:", res.status, err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("[whatsapp] fetch failed:", e);
    return { ok: false, error: String(e) };
  }
}
