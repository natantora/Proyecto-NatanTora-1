interface PendingApprovalEmailParams {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  approveUrl: string;
  rejectUrl: string;
  adminPanelUrl: string;
}

/**
 * Email HTML inline-CSS para máxima compatibilidad con clientes
 * (Gmail, Outlook, iOS Mail, Yahoo). Sin <link>, sin <style> externos.
 */
export function pendingApprovalEmail(p: PendingApprovalEmailParams): string {
  const waLink = p.requesterPhone
    ? `https://wa.me/${p.requesterPhone.replace(/\D/g, "")}`
    : null;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nueva solicitud de membresía</title>
</head>
<body style="margin:0;padding:0;background:#F7F1E3;font-family:Georgia,'Times New Roman',serif;color:#2C2416;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F7F1E3;">
  <tr>
    <td align="center" style="padding:40px 20px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FBF7EB;border:1px solid #D9CDB0;">

        <!-- Top bar -->
        <tr>
          <td style="background:#0F1A30;padding:20px 32px;">
            <table role="presentation" width="100%"><tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.3em;color:#D4B576;font-weight:bold;text-transform:uppercase;">
                Midrash Natán Torá
              </td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.2em;color:rgba(247,241,227,0.5);text-transform:uppercase;">
                Plaza Polanco · CDMX
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:48px 40px 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.3em;color:#8F6F37;text-transform:uppercase;font-weight:bold;margin-bottom:14px;">
              — Nueva solicitud de membresía
            </div>
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:32px;line-height:1.2;color:#1B2A4E;letter-spacing:-0.01em;">
              ${escapeHtml(p.requesterName)}
              <span style="color:#8B7B5C;"> · </span>
              <em style="color:#8F6F37;">pide acceso</em>
            </h1>
          </td>
        </tr>

        <!-- Requester info -->
        <tr>
          <td style="padding:0 40px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #D9CDB0;border-bottom:1px solid #D9CDB0;">
              <tr>
                <td style="padding:18px 0;border-bottom:1px solid #E8DFC7;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.22em;color:#8B7B5C;text-transform:uppercase;font-weight:bold;">Nombre</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1B2A4E;margin-top:4px;">${escapeHtml(p.requesterName)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 0;border-bottom:1px solid #E8DFC7;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.22em;color:#8B7B5C;text-transform:uppercase;font-weight:bold;">Email</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1B2A4E;margin-top:4px;"><a href="mailto:${escapeHtml(p.requesterEmail)}" style="color:#1B2A4E;text-decoration:none;border-bottom:1px solid #B8924A;">${escapeHtml(p.requesterEmail)}</a></div>
                </td>
              </tr>
              ${p.requesterPhone ? `
              <tr>
                <td style="padding:18px 0;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.22em;color:#8B7B5C;text-transform:uppercase;font-weight:bold;">Teléfono</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1B2A4E;margin-top:4px;">
                    ${escapeHtml(p.requesterPhone)}
                    ${waLink ? `&nbsp;·&nbsp;<a href="${waLink}" style="color:#8F6F37;text-decoration:none;border-bottom:1px solid #B8924A;font-size:13px;">Abrir en WhatsApp →</a>` : ""}
                  </div>
                </td>
              </tr>
              ` : ""}
            </table>
          </td>
        </tr>

        <!-- Action buttons -->
        <tr>
          <td style="padding:32px 40px 16px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 8px;">
                  <a href="${p.approveUrl}" style="display:inline-block;background:#1B2A4E;color:#F7F1E3;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:bold;padding:16px 32px;">
                    Aprobar →
                  </a>
                </td>
                <td style="padding:0 8px;">
                  <a href="${p.rejectUrl}" style="display:inline-block;background:transparent;color:#5C4F3A;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:bold;padding:15px 32px;border:1px solid #D9CDB0;">
                    Rechazar
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Help text -->
        <tr>
          <td style="padding:8px 40px 32px;" align="center">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8B7B5C;line-height:1.6;text-align:center;">
              Un clic en cualquier botón abre una página de confirmación
              <br>para que verifiques antes de procesar.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#EFE6CF;padding:24px 40px;border-top:1px solid #D9CDB0;">
            <table role="presentation" width="100%"><tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5C4F3A;line-height:1.6;">
                También puedes administrar miembros desde el
                <a href="${p.adminPanelUrl}" style="color:#8F6F37;text-decoration:none;border-bottom:1px solid #B8924A;">panel de administración</a>.
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Brand mark -->
        <tr>
          <td style="background:#0F1A30;padding:18px 40px;" align="center">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.3em;color:rgba(247,241,227,0.4);text-transform:uppercase;font-weight:bold;">
              Minhag Halabi · Aram Tzobá
            </div>
          </td>
        </tr>

      </table>

      <p style="margin-top:24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8B7B5C;line-height:1.5;max-width:600px;">
        Recibes este email porque eres administrador del Midrash Natán Torá. Si no reconoces esta solicitud puedes ignorarla — el enlace expira en 7 días.
      </p>

    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type MemberDecisionEmailParams = {
  memberName: string;
  status: "approved" | "rejected";
  siteUrl: string;
};

type ReservationEmailParams = {
  memberName: string;
  eventTitle: string;
  eventDate: Date | string;
  location: string;
  seats: string[];
  quantity: number;
  total: number;
  eventUrl: string;
};

type PaymentReceiptEmailParams = {
  memberName: string;
  amount: number;
  method: "cash" | "stripe" | "mercadopago";
  concepts: string[];
  remainingBalance: number;
  accountUrl: string;
  paidAt?: Date | string;
};

type DonationReceiptEmailParams = {
  donorName: string;
  amount: number;
  purpose: string;
  recurring: boolean;
  paidAt?: Date | string;
  siteUrl: string;
};

type PasswordResetEmailParams = {
  memberName: string;
  resetUrl: string;
};

function transactionalEmail(params: {
  preview: string;
  eyebrow: string;
  title: string;
  body: string;
  details?: Array<[string, string]>;
  buttonLabel?: string;
  buttonUrl?: string;
}): string {
  const details = params.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;border-top:1px solid #D9CDB0;">${params.details.map(([label, value]) => `<tr><td style="padding:14px 0;border-bottom:1px solid #E8DFC7;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;font-weight:bold;color:#8B7B5C;">${escapeHtml(label)}</div><div style="margin-top:5px;font-size:14px;line-height:1.5;color:#1B2A4E;">${escapeHtml(value)}</div></td></tr>`).join("")}</table>`
    : "";
  const button = params.buttonLabel && params.buttonUrl
    ? `<p style="margin:30px 0 0;"><a href="${params.buttonUrl}" style="display:inline-block;background:#1B2A4E;color:#F7F1E3;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:bold;padding:15px 25px;">${escapeHtml(params.buttonLabel)} →</a></p>`
    : "";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(params.preview)}</title></head><body style="margin:0;padding:0;background:#F7F1E3;color:#2C2416;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preview)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F1E3;"><tr><td align="center" style="padding:38px 18px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FBF7EB;border:1px solid #D9CDB0;"><tr><td style="background:#0F1A30;padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.28em;text-transform:uppercase;font-weight:bold;color:#D4B576;">Midrash Natán Torá <span style="float:right;color:rgba(247,241,227,.5);">Plaza Polanco · CDMX</span></td></tr><tr><td style="padding:44px 40px;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:.28em;text-transform:uppercase;font-weight:bold;color:#8F6F37;">— ${escapeHtml(params.eyebrow)}</div><h1 style="margin:14px 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:normal;color:#1B2A4E;">${escapeHtml(params.title)}</h1><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.75;color:#5C4F3A;">${params.body}</div>${details}${button}</td></tr><tr><td align="center" style="background:#0F1A30;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:rgba(247,241,227,.45);">Minhag Halabi · Aram Tzobá</td></tr></table></td></tr></table></body></html>`;
}

function formatEventDate(value: Date | string): string {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export function memberDecisionEmail(p: MemberDecisionEmailParams): string {
  const approved = p.status === "approved";
  return transactionalEmail({
    preview: approved ? "Tu membresía fue aprobada" : "Actualización de tu solicitud de membresía",
    eyebrow: "Solicitud de membresía",
    title: approved ? `¡Bienvenido, ${p.memberName}!` : `Hola, ${p.memberName}`,
    body: approved
      ? "Tu solicitud fue aprobada. Ya puedes iniciar sesión y acceder a las funciones privadas de la comunidad."
      : "Por el momento tu solicitud no fue aprobada. Si consideras que hubo un error, responde a este correo para comunicarte con la administración.",
    buttonLabel: approved ? "Entrar a NatanTora" : "Volver al sitio",
    buttonUrl: p.siteUrl,
  });
}

export function reservationConfirmationEmail(p: ReservationEmailParams): string {
  const seatText = p.seats.length ? p.seats.join(", ") : "Lugar libre (sin asiento asignado)";
  return transactionalEmail({
    preview: `Reservación confirmada para ${p.eventTitle}`,
    eyebrow: "Reservación confirmada",
    title: p.eventTitle,
    body: `Gracias, ${escapeHtml(p.memberName)}. Tu reservación quedó registrada correctamente.`,
    details: [
      ["Fecha", formatEventDate(p.eventDate)],
      ["Lugar", p.location],
      [p.quantity === 1 ? "Asiento" : "Asientos", seatText],
      ["Cantidad", String(p.quantity)],
      ["Importe", p.total > 0 ? formatMoney(p.total) : "Gratuito"],
    ],
    buttonLabel: "Ver evento",
    buttonUrl: p.eventUrl,
  });
}

export function reservationCancellationEmail(p: ReservationEmailParams): string {
  return transactionalEmail({
    preview: `Reservación cancelada para ${p.eventTitle}`,
    eyebrow: "Reservación cancelada",
    title: p.eventTitle,
    body: `Hola, ${escapeHtml(p.memberName)}. La reservación indicada fue cancelada por la administración. Los lugares quedaron liberados.`,
    details: [
      ["Fecha", formatEventDate(p.eventDate)],
      ["Lugar", p.location],
      ["Lugares cancelados", p.seats.length ? p.seats.join(", ") : String(p.quantity)],
    ],
    buttonLabel: "Ver eventos",
    buttonUrl: p.eventUrl,
  });
}

export function paymentReceiptEmail(p: PaymentReceiptEmailParams): string {
  return transactionalEmail({
    preview: `Recibo de pago por ${formatMoney(p.amount)}`,
    eyebrow: "Pago recibido",
    title: "Gracias por tu pago",
    body: `Hola, ${escapeHtml(p.memberName)}. Registramos correctamente tu pago en el estado de cuenta.`,
    details: [
      ["Importe pagado", formatMoney(p.amount)],
      ["Método", p.method === "cash" ? "Efectivo" : p.method === "mercadopago" ? "Mercado Pago" : "Tarjeta"],
      ["Fecha", formatEventDate(p.paidAt ?? new Date())],
      ["Aplicado a", p.concepts.length ? p.concepts.join(", ") : "Estado de cuenta"],
      ["Saldo pendiente", formatMoney(p.remainingBalance)],
    ],
    buttonLabel: "Ver mi estado de cuenta",
    buttonUrl: p.accountUrl,
  });
}

export function donationReceiptEmail(p: DonationReceiptEmailParams): string {
  return transactionalEmail({
    preview: `Recibo de donativo por ${formatMoney(p.amount)}`,
    eyebrow: "Donativo recibido",
    title: "Gracias por apoyar al Midrash",
    body: `Hola, ${escapeHtml(p.donorName)}. Recibimos correctamente tu donativo. Tu apoyo sostiene las clases, actividades y proyectos de la comunidad.`,
    details: [
      ["Importe", formatMoney(p.amount)],
      ["Destino", p.purpose],
      ["Frecuencia", p.recurring ? "Mensual" : "Una sola vez"],
      ["Fecha", formatEventDate(p.paidAt ?? new Date())],
    ],
    buttonLabel: "Volver al sitio",
    buttonUrl: p.siteUrl,
  });
}

export function passwordResetEmail(p: PasswordResetEmailParams): string {
  return transactionalEmail({
    preview: "Restablece tu contraseña de Natán Torá",
    eyebrow: "Seguridad de tu cuenta",
    title: "Restablece tu contraseña",
    body: `Hola, ${escapeHtml(p.memberName)}. Recibimos una solicitud para cambiar la contraseña de tu cuenta. Este enlace es personal, solo puede utilizarse una vez y vencerá en 30 minutos.<br><br>Si tú no solicitaste este cambio, puedes ignorar este correo; tu contraseña seguirá siendo la misma.`,
    buttonLabel: "Crear contraseña nueva",
    buttonUrl: p.resetUrl,
  });
}
