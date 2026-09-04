import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireBillingAdmin } from "@/lib/billing";
import { transaction } from "@/lib/db";
import { recordFinancialAudit } from "@/lib/financial-audit";
import { parseLegacyBillingWorkbook } from "@/lib/legacy-billing-workbook";

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona el archivo de cobranza" }, { status: 400 });
  if (form.get("replace_existing") !== "true" || form.get("confirmation") !== "REEMPLAZAR") {
    return NextResponse.json({ error: "Falta confirmar el reemplazo de las cuentas actuales" }, { status: 400 });
  }

  try {
    const parsed = await parseLegacyBillingWorkbook(file);
    const result = await transaction(async (client) => {
      const previous = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM billing_accounts");
      const previousAccountCount = Number(previous.rows[0]?.count || 0);
      if (previousAccountCount > 3) {
        throw new Error("La migración inicial está bloqueada porque ya existen más de 3 cuentas. No se eliminó ningún dato.");
      }
      const deletedPayments = await client.query("DELETE FROM payments WHERE billing_account_id IS NOT NULL");
      await client.query("DELETE FROM billing_accounts");
      await client.query("DELETE FROM billing_imports");

      const importId = randomUUID();
      await client.query(
        `INSERT INTO billing_imports (id, filename, imported_by, total_rows, imported_rows, error_rows)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [importId, file.name, admin.user.id, parsed.summary.charges + parsed.summary.skippedCharges, parsed.summary.charges, parsed.summary.skippedCharges],
      );

      const accountIds = new Map<string, string>();
      const accountRows = parsed.accounts.map((item) => {
        const id = randomUUID(); accountIds.set(item.legacyId, id);
        return { id, display_name: item.name, phone: item.phone, external_reference: item.reference, created_by: admin.user.id };
      });
      await client.query(
        `INSERT INTO billing_accounts (id, display_name, phone, external_reference, created_by)
         SELECT x.id::uuid, x.display_name, x.phone, x.external_reference, x.created_by::uuid
           FROM jsonb_to_recordset($1::jsonb) AS x(id text, display_name text, phone text, external_reference text, created_by text)`,
        [JSON.stringify(accountRows)],
      );

      const chargeIds = new Map<string, string>();
      const chargeRows = parsed.charges.map((item) => {
        const id = randomUUID(); chargeIds.set(item.reference, id);
        return { id, account_id: accountIds.get(item.accountLegacyId), import_id: importId, external_reference: item.reference, concept: item.concept, period: item.period, original_amount: item.amount, outstanding_amount: item.outstanding, status: item.status, notes: item.notes, created_by: admin.user.id, created_at: `${item.date}T12:00:00-06:00` };
      });
      await client.query(
        `INSERT INTO billing_charges
          (id, account_id, import_id, external_reference, concept, period, original_amount, outstanding_amount, status, source, notes, created_by, created_at)
         SELECT x.id::uuid, x.account_id::uuid, x.import_id::uuid, x.external_reference, x.concept, x.period,
                x.original_amount, x.outstanding_amount, x.status, 'excel', x.notes, x.created_by::uuid, x.created_at::timestamptz
           FROM jsonb_to_recordset($1::jsonb) AS x(id text, account_id text, import_id text, external_reference text, concept text, period text, original_amount numeric, outstanding_amount numeric, status text, notes text, created_by text, created_at text)`,
        [JSON.stringify(chargeRows)],
      );

      const paymentIds = new Map<string, string>();
      const paymentRows = parsed.payments.map((item) => {
        const id = randomUUID(); paymentIds.set(item.reference, id);
        return { id, billing_account_id: accountIds.get(item.accountLegacyId), amount: item.amount, payment_method: item.method, description: item.description, metadata: { ...item.metadata, notes: item.notes }, paid_at: `${item.date}T12:00:00-06:00` };
      });
      await client.query(
        `INSERT INTO payments
          (id, billing_account_id, amount, currency, status, payment_method, description, metadata, created_at, paid_at, billing_applied_at)
         SELECT x.id::uuid, x.billing_account_id::uuid, x.amount, 'MXN', 'paid', x.payment_method, x.description,
                x.metadata, x.paid_at::timestamptz, x.paid_at::timestamptz, x.paid_at::timestamptz
           FROM jsonb_to_recordset($1::jsonb) AS x(id text, billing_account_id text, amount numeric, payment_method text, description text, metadata jsonb, paid_at text)`,
        [JSON.stringify(paymentRows)],
      );

      const allocationRows = parsed.allocations.map((item) => ({ payment_id: paymentIds.get(item.paymentReference), charge_id: chargeIds.get(item.chargeReference), amount: item.amount }));
      if (allocationRows.length) await client.query(
        `INSERT INTO billing_payment_allocations (payment_id, charge_id, amount)
         SELECT x.payment_id::uuid, x.charge_id::uuid, x.amount
           FROM jsonb_to_recordset($1::jsonb) AS x(payment_id text, charge_id text, amount numeric)`,
        [JSON.stringify(allocationRows)],
      );

      await recordFinancialAudit(client, {
        actorId: admin.user.id, action: "billing_import.legacy_replaced", entityType: "billing_import", entityId: importId,
        before: { accounts: previousAccountCount, payments: deletedPayments.rowCount || 0 },
        after: parsed.summary, metadata: { filename: file.name, warnings: parsed.warnings },
      });
      return { removedAccounts: previousAccountCount, removedPayments: deletedPayments.rowCount || 0, ...parsed.summary };
    });
    revalidatePath("/admin/accounts");
    revalidatePath("/mi-cuenta");
    return NextResponse.json({ ok: true, summary: result });
  } catch (error) {
    console.error("[billing/import/legacy]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo completar la importación" }, { status: 500 });
  }
}
