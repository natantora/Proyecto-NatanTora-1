import { NextResponse, type NextRequest } from "next/server";
import { requireBillingAdmin } from "@/lib/billing";
import { query } from "@/lib/db";
import { parseLegacyBillingWorkbook } from "@/lib/legacy-billing-workbook";

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona el archivo de cobranza" }, { status: 400 });
  try {
    const parsed = await parseLegacyBillingWorkbook(file);
    const existing = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM billing_accounts");
    return NextResponse.json({ filename: file.name, summary: parsed.summary, warnings: parsed.warnings, existingAccounts: Number(existing.rows[0]?.count || 0) });
  } catch (error) {
    console.error("[billing/import/legacy/preview]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el archivo" }, { status: 400 });
  }
}
