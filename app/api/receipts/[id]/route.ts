import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createReceiptPdf } from "@/lib/financial-pdf";
import { canManagePayments, type Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await context.params;
  const payment = await query<{ id: string; user_id: string | null; billing_account_id: string | null; amount: string; status: string; payment_method: string | null; donor_name: string | null; donor_email: string | null; description: string | null; paid_at: Date | null; created_at: Date; account_name: string | null; owns_account: boolean; concepts: string[] }>(
    `SELECT payment.id, payment.user_id, payment.billing_account_id, payment.amount::text, payment.status,
      payment.payment_method, payment.donor_name, payment.donor_email, payment.description,
      payment.paid_at, payment.created_at, account.display_name AS account_name,
      EXISTS (SELECT 1 FROM billing_account_members member WHERE member.account_id = payment.billing_account_id AND member.profile_id = $2) AS owns_account,
      ARRAY(SELECT charge.concept FROM billing_payment_allocations allocation JOIN billing_charges charge ON charge.id = allocation.charge_id WHERE allocation.payment_id = payment.id ORDER BY charge.created_at) AS concepts
      FROM payments payment LEFT JOIN billing_accounts account ON account.id = payment.billing_account_id
      WHERE payment.id = $1 LIMIT 1`,
    [id, user.id],
  );
  const row = payment.rows[0];
  const admin = canManagePayments(user.role as Role);
  if (!row || (!admin && row.user_id !== user.id && !row.owns_account)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (row.status !== "paid") return NextResponse.json({ error: "El pago todavía no está confirmado" }, { status: 409 });
  const methods: Record<string, string> = { cash: "Efectivo", mercadopago: "Mercado Pago", stripe: "Tarjeta" };
  const bytes = await createReceiptPdf({ id: row.id, name: row.account_name || row.donor_name || user.full_name || user.email, email: row.donor_email, amount: Number(row.amount), method: methods[row.payment_method || ""] || row.payment_method || "Otro", paidAt: row.paid_at ?? row.created_at, description: row.description || "Pago", concepts: row.concepts || [], status: row.status });
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="comprobante-${row.id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
}
