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
