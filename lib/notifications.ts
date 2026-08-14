import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "./email";
import { sendWhatsApp } from "./whatsapp";
import { createApprovalTokens } from "./approval-tokens";
import { pendingApprovalEmail } from "./email-templates";

interface NotifyParams {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "https://natantora.com"
  );
}

/**
 * Notifica a todos los administradores activos (email + WhatsApp si
 * estan configurados) que un nuevo usuario solicita acceso. Genera
 * tokens 1-clic para aprobar o rechazar desde el email/WhatsApp.
 *
 * Es fire-and-forget: cualquier error de envio no rompe el flujo
 * principal de registro.
 */
export async function notifyAdminsOfPending(params: NotifyParams): Promise<void> {
  try {
    const tokens = await createApprovalTokens(params.userId);
    if (!tokens) {
      console.error("[notify] No se pudieron generar tokens");
      return;
    }

    const site = getSiteUrl();
    const approveUrl = `${site}/approve/${tokens.approveToken}`;
    const rejectUrl = `${site}/approve/${tokens.rejectToken}`;
    const adminPanelUrl = `${site}/admin/members`;

    // Obtener todos los admins aprobados
    const admin = createAdminClient();
    const { data: admins, error } = await admin
      .from("profiles")
      .select("email, phone, full_name")
      .eq("role", "admin")
      .eq("status", "approved");

    if (error || !admins || admins.length === 0) {
      console.warn("[notify] No hay admins activos a quienes notificar");
      return;
    }

    console.log(
      `[notify] notificando a ${admins.length} admin(s) sobre ${params.fullName}`
    );

    // --- EMAIL ---
    const html = pendingApprovalEmail({
      requesterName: params.fullName,
      requesterEmail: params.email,
      requesterPhone: params.phone,
      approveUrl,
      rejectUrl,
      adminPanelUrl,
    });

    const emailText = `Nueva solicitud de membresía en el Midrash Natán Torá.

Nombre: ${params.fullName}
Email: ${params.email}
${params.phone ? `Teléfono: ${params.phone}\n` : ""}
Aprobar: ${approveUrl}
Rechazar: ${rejectUrl}

Panel admin: ${adminPanelUrl}

El enlace expira en 7 días.`;

    for (const a of admins) {
      if (!a.email) continue;
      sendEmail({
        to: a.email,
        subject: `Nueva solicitud de membresía — ${params.fullName}`,
        html,
        text: emailText,
        replyTo: params.email,
      }).catch((e) => console.error("[notify] email failed for", a.email, e));
    }

    // --- WHATSAPP ---
    const templateName =
      process.env.WHATSAPP_TEMPLATE_NAME || "pending_member_notification";

    for (const a of admins) {
      if (!a.phone) continue;
      // Plantilla esperada (que el admin debe crear en Meta Business Manager):
      // body: "Nueva solicitud de membresía en el Midrash:\n\nNombre: {{1}}\nEmail: {{2}}\n\nPara aprobar o rechazar abre: {{3}}"
      // (variables: nombre, email, link approve)
      sendWhatsApp({
        to: a.phone,
        templateName,
        languageCode: "es_MX",
        bodyParams: [params.fullName, params.email, approveUrl],
      }).catch((e) =>
        console.error("[notify] whatsapp failed for", a.phone, e)
      );
    }
  } catch (e) {
    console.error("[notify] error general:", e);
  }
}
