import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { cleanText, money, requireBillingAdmin } from "@/lib/billing";
import { transaction } from "@/lib/db";
import { sendPaymentReceipt } from "@/lib/transactional-emails";

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const accountId = cleanText(body.account_id, 80);
  const amount = money(body.amount);
  const notes = cleanText(body.notes, 500) || null;
  if (!accountId || !amount) return NextResponse.json({ error: "Cuenta e importe son obligatorios" }, { status: 400 });

  try {
    const result = await transaction(async (client) => {
      const charges = await client.query<{ id: string; concept: string; outstanding_amount: string }>(
        `SELECT id, concept, outstanding_amount::text
           FROM billing_charges
          WHERE account_id = $1 AND status = 'open' AND outstanding_amount > 0
          ORDER BY due_date NULLS LAST, created_at
          FOR UPDATE`,
        [accountId],
      );
      const totalOutstanding = charges.rows.reduce((sum, row) => sum + Number(row.outstanding_amount), 0);
      if (amount > totalOutstanding + 0.001) throw new Error("El pago supera el saldo pendiente");

      const account = await client.query<{ display_name: string; email: string | null }>(
        "SELECT display_name, email FROM billing_accounts WHERE id = $1",
        [accountId],
      );
      if (!account.rows[0]) throw new Error("Cuenta no encontrada");

      // Un pago en efectivo nunca debe permanecer pendiente. Limpia intentos
      // anteriores que se hayan quedado incompletos antes de registrar el nuevo.
      await client.query(
        `UPDATE payments
            SET status = 'failed'
          WHERE billing_account_id = $1
            AND payment_method = 'cash'
            AND status = 'pending'
            AND billing_applied_at IS NULL`,
        [accountId],
      );

      const payment = await client.query<{ id: string }>(
        `INSERT INTO payments
          (billing_account_id, amount, status, payment_method, donor_name,
           donor_email, description, metadata, paid_at, billing_applied_at)
         VALUES ($1, $2, 'paid', 'cash', $3, $4, 'Pago de estado de cuenta',
                 jsonb_build_object('kind', 'billing', 'notes', $5::text, 'registered_by', $6::text), NOW(), NOW())
         RETURNING id`,
        [accountId, amount, account.rows[0].display_name, account.rows[0].email, notes, admin.user.id],
      );
      let remaining = amount;
      const appliedConcepts: string[] = [];
      for (const charge of charges.rows) {
        if (remaining <= 0) break;
        const allocation = Math.min(remaining, Number(charge.outstanding_amount));
        if (allocation > 0) appliedConcepts.push(charge.concept);
        await client.query(
          `INSERT INTO billing_payment_allocations (payment_id, charge_id, amount) VALUES ($1, $2, $3)`,
          [payment.rows[0].id, charge.id, allocation],
        );
        const outstanding = Math.round((Number(charge.outstanding_amount) - allocation) * 100) / 100;
        await client.query(
          `UPDATE billing_charges
              SET outstanding_amount = $2,
                  status = CASE WHEN $2 = 0 THEN 'paid' ELSE 'open' END,
                  updated_at = NOW()
            WHERE id = $1`,
          [charge.id, outstanding],
        );
        remaining = Math.round((remaining - allocation) * 100) / 100;
      }
      if (remaining !== 0) throw new Error("No se pudo aplicar el importe completo");
      const summary = await client.query<{ open_balance: string; open_charges: string }>(
        `SELECT COALESCE(SUM(outstanding_amount) FILTER (WHERE status = 'open'), 0)::text AS open_balance,
                COUNT(*) FILTER (WHERE status = 'open')::text AS open_charges
           FROM billing_charges
          WHERE account_id = $1`,
        [accountId],
      );
      return {
        ...payment.rows[0],
        amount,
        account_id: accountId,
        open_balance: Number(summary.rows[0].open_balance),
        open_charges: Number(summary.rows[0].open_charges),
        receipt: account.rows[0].email ? {
          email: account.rows[0].email,
          memberName: account.rows[0].display_name,
          concepts: appliedConcepts,
        } : null,
      };
    });
    if (result.receipt) {
      await sendPaymentReceipt({
        ...result.receipt,
        amount: result.amount,
        method: "cash",
        remainingBalance: result.open_balance,
      }).catch((emailError) => console.error("[billing/cash] receipt email failed:", emailError));
    }
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/payments");
    revalidatePath("/mi-cuenta");
    return NextResponse.json({
      ok: true,
      payment: {
        id: result.id,
        amount: result.amount,
        account_id: result.account_id,
        open_balance: result.open_balance,
        open_charges: result.open_charges,
      },
    });
  } catch (error: unknown) {
    console.error("[billing/cash]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el pago" }, { status: 400 });
  }
}
