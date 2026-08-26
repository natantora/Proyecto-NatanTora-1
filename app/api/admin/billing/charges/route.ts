import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { cleanText, manualReference, money, requireBillingAdmin } from "@/lib/billing";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const accountId = cleanText(body.account_id, 80);
  const concept = cleanText(body.concept, 180);
  const period = cleanText(body.period, 100) || null;
  const amount = money(body.amount);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(body.due_date ?? "") ? body.due_date : null;
  const notes = cleanText(body.notes, 1000) || null;
  if (!accountId || !concept || !amount) {
    return NextResponse.json({ error: "Cuenta, concepto e importe son obligatorios" }, { status: 400 });
  }
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO billing_charges
        (account_id, external_reference, concept, period, original_amount,
         outstanding_amount, source, due_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $5, 'manual', $6, $7, $8)
       RETURNING id`,
      [accountId, manualReference(), concept, period, amount, dueDate, notes, admin.user.id],
    );
    revalidatePath("/admin/accounts");
    revalidatePath("/mi-cuenta");
    return NextResponse.json({ ok: true, charge: result.rows[0] });
  } catch {
    return NextResponse.json({ error: "No se pudo crear el cargo" }, { status: 500 });
  }
}
