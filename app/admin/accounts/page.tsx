import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canManageBilling } from "@/lib/permissions";
import AccountsAdmin from "./AccountsAdmin";
import type { BillingAccountRow, BillingChargeRow, BillingPaymentRow, ImportSummary, ProfileOption } from "./types";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/admin/accounts");
  const role = await getUserRole(user.id);
  if (!canManageBilling(role)) redirect("/admin/dashboard?error=no_access");

  const [accountResult, profileResult, importResult, chargeResult, paymentResult] = await Promise.all([
    query<{
      id: string; display_name: string; email: string | null; phone: string | null;
      external_reference: string | null; notes: string | null; profile_id: string | null;
      profile_name: string | null; profile_email: string | null; open_balance: string;
      open_charges: string; total_paid: string;
    }>(
      `SELECT account.id, account.display_name, account.email, account.phone,
              account.external_reference, account.notes, member.profile_id,
              profile.full_name AS profile_name, profile.email AS profile_email,
              COALESCE(charges.open_balance, 0)::text AS open_balance,
              COALESCE(charges.open_charges, 0)::text AS open_charges,
              COALESCE(paid.total_paid, 0)::text AS total_paid
         FROM billing_accounts account
         LEFT JOIN billing_account_members member ON member.account_id = account.id
         LEFT JOIN profiles profile ON profile.id = member.profile_id
         LEFT JOIN LATERAL (
           SELECT SUM(outstanding_amount) AS open_balance,
                  COUNT(*) FILTER (WHERE status = 'open') AS open_charges
             FROM billing_charges WHERE account_id = account.id
         ) charges ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(amount) AS total_paid FROM payments
            WHERE billing_account_id = account.id AND status = 'paid'
         ) paid ON TRUE
        WHERE account.active = TRUE
        ORDER BY account.display_name`,
    ),
    query<ProfileOption>(
      `SELECT id, COALESCE(full_name, email) AS full_name, email
         FROM profiles WHERE status = 'approved' ORDER BY COALESCE(full_name, email)`,
    ),
    query<ImportSummary>(
      `SELECT id, filename, total_rows, imported_rows, duplicate_rows, error_rows,
              created_at::text
         FROM billing_imports ORDER BY created_at DESC LIMIT 8`,
    ),
    query<BillingChargeRow & { account_id: string; original_amount: number; outstanding_amount: number }>(
      `SELECT id, account_id, concept, period,
              original_amount::float8 AS original_amount,
              outstanding_amount::float8 AS outstanding_amount,
              status, source, due_date::text, notes, created_at::text
         FROM billing_charges
        ORDER BY created_at DESC`,
    ),
    query<BillingPaymentRow & { billing_account_id: string; amount: number }>(
      `SELECT payment.id, payment.billing_account_id,
              payment.amount::float8 AS amount, payment.status,
              payment.payment_method, payment.description,
              payment.metadata->>'notes' AS notes,
              payment.paid_at::text, payment.created_at::text,
              NULLIF(STRING_AGG(DISTINCT charge.concept, ' · '), '') AS applied_to
         FROM payments payment
         LEFT JOIN billing_payment_allocations allocation ON allocation.payment_id = payment.id
         LEFT JOIN billing_charges charge ON charge.id = allocation.charge_id
        WHERE payment.billing_account_id IS NOT NULL
        GROUP BY payment.id
        ORDER BY COALESCE(payment.paid_at, payment.created_at) DESC`,
    ),
  ]);

  const accounts: BillingAccountRow[] = accountResult.rows.map((row) => ({
    ...row,
    open_balance: Number(row.open_balance),
    open_charges: Number(row.open_charges),
    total_paid: Number(row.total_paid),
    charges: chargeResult.rows.filter((charge) => charge.account_id === row.id),
    payments: paymentResult.rows.filter((payment) => payment.billing_account_id === row.id),
  }));

  return (
    <AccountsAdmin accounts={accounts} profiles={profileResult.rows} imports={importResult.rows} />
  );
}
