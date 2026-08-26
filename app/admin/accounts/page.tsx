import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canManageBilling } from "@/lib/permissions";
import AccountsAdmin from "./AccountsAdmin";
import type { BillingAccountRow, ImportSummary, ProfileOption } from "./types";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/admin/accounts");
  const role = await getUserRole(user.id);
  if (!canManageBilling(role)) redirect("/admin/dashboard?error=no_access");

  const [accountResult, profileResult, importResult] = await Promise.all([
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
  ]);

  const accounts: BillingAccountRow[] = accountResult.rows.map((row) => ({
    ...row,
    open_balance: Number(row.open_balance),
    open_charges: Number(row.open_charges),
    total_paid: Number(row.total_paid),
  }));

  return (
    <AccountsAdmin accounts={accounts} profiles={profileResult.rows} imports={importResult.rows} />
  );
}
