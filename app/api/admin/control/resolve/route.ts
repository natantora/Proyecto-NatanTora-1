import { NextResponse, type NextRequest } from "next/server";
import { requireBillingAdmin } from "@/lib/billing";
import { query } from "@/lib/db";
import { siteOrigin } from "@/lib/site-url";

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData();
  const alertId = String(form.get("alert_id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(alertId)) {
    await query("UPDATE system_alerts SET status = 'resolved', resolved_at = NOW(), resolved_by = $2 WHERE id = $1", [alertId, admin.user.id]);
  }
  return NextResponse.redirect(`${siteOrigin()}/admin/control`, 303);
}
