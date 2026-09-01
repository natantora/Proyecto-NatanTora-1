import { sendEmail } from "@/lib/email";
import { query } from "@/lib/db";
import { siteOrigin } from "@/lib/site-url";

type AlertSeverity = "warning" | "critical";

function safeError(value: unknown): string {
  return value instanceof Error ? value.message.slice(0, 1000) : String(value).slice(0, 1000);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function reportSystemAlert(input: {
  severity: AlertSeverity;
  category: string;
  title: string;
  message: string;
  fingerprint: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const result = await query<{ id: string; should_notify: boolean }>(
      `INSERT INTO system_alerts
         (severity, category, title, message, fingerprint, context)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (fingerprint) DO UPDATE SET
         severity = EXCLUDED.severity,
         category = EXCLUDED.category,
         title = EXCLUDED.title,
         message = EXCLUDED.message,
         context = EXCLUDED.context,
         status = 'open',
         resolved_at = NULL,
         resolved_by = NULL,
         occurrence_count = system_alerts.occurrence_count + 1,
         last_occurred_at = NOW()
       RETURNING id,
         (last_notified_at IS NULL OR last_notified_at < NOW() - INTERVAL '1 hour') AS should_notify`,
      [input.severity, input.category, input.title, input.message.slice(0, 2000), input.fingerprint.slice(0, 240), JSON.stringify(input.context ?? {})],
    );
    const alert = result.rows[0];
    if (!alert?.should_notify) return;
    const admins = await query<{ email: string }>(
      `SELECT DISTINCT email FROM profiles
        WHERE role IN ('admin', 'owner') AND status = 'approved' AND email IS NOT NULL`,
    );
    if (!admins.rowCount) return;
    const adminUrl = `${siteOrigin()}/admin/control`;
    const delivery = await sendEmail({
      to: admins.rows.map((row) => row.email),
      subject: `${input.severity === "critical" ? "Alerta crítica" : "Advertencia"} — ${input.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h1 style="color:#17264d">${escapeHtml(input.title)}</h1><p>${escapeHtml(input.message)}</p><p><a href="${adminUrl}">Abrir el centro de control</a></p><p style="color:#777;font-size:12px">Categoría: ${escapeHtml(input.category)}</p></div>`,
      text: `${input.title}\n\n${input.message}\n\nRevisar: ${adminUrl}`,
    });
    await query(
      `UPDATE system_alerts SET last_notified_at = NOW(), email_delivery_error = $2 WHERE id = $1`,
      [alert.id, delivery.ok ? null : (delivery.error ?? "No se pudo enviar el correo").slice(0, 1000)],
    );
  } catch (error) {
    console.error("[system-alerts] no se pudo registrar alerta:", safeError(error));
  }
}

export async function reportEmailFailure(context: string, error: unknown, reference?: string): Promise<void> {
  await reportSystemAlert({
    severity: "warning",
    category: "email",
    title: "No se pudo enviar un correo transaccional",
    message: `${context}: ${safeError(error)}`,
    fingerprint: `email:${context}`,
    context: reference ? { reference } : {},
  });
}
