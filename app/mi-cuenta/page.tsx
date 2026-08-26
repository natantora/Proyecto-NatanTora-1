import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import AccountStatementClient from "./AccountStatementClient";

export const dynamic = "force-dynamic";

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/mi-cuenta");
  if (user.status !== "approved") redirect("/auth/pendiente");

  const accountResult = await query<{
    id: string; display_name: string; email: string | null; external_reference: string | null;
  }>(
    `SELECT account.id, account.display_name, account.email, account.external_reference
       FROM billing_account_members member
       JOIN billing_accounts account ON account.id = member.account_id AND account.active = TRUE
      WHERE member.profile_id = $1 LIMIT 1`,
    [user.id],
  );
  const account = accountResult.rows[0] ?? null;
  if (!account) {
    return (
      <section className="min-h-[65vh] bg-cream px-6 py-20">
        <div className="mx-auto max-w-3xl border border-line bg-cream-light p-8 sm:p-12">
          <div className="eyebrow eyebrow-line mb-4 text-gold">Cuenta privada</div>
          <h1 className="serif-display text-[40px] leading-none text-navy">Mi estado de cuenta</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">Tu usuario todavía no está vinculado a un estado de cuenta. Si esperabas ver un saldo, solicita al administrador que relacione tu correo <strong>{user.email}</strong>.</p>
        </div>
      </section>
    );
  }

  const [chargesResult, paymentsResult] = await Promise.all([
    query<{
      id: string; concept: string; period: string | null; original_amount: string;
      outstanding_amount: string; due_date: string | null; notes: string | null; created_at: string;
    }>(
      `SELECT id, concept, period, original_amount::text, outstanding_amount::text,
              due_date::text, notes, created_at::text
         FROM billing_charges
        WHERE account_id = $1 AND status = 'open' AND outstanding_amount > 0
        ORDER BY due_date NULLS LAST, created_at`,
      [account.id],
    ),
    query<{
      id: string; amount: string; status: string; payment_method: string | null;
      description: string | null; created_at: string; paid_at: string | null;
    }>(
      `SELECT id, amount::text, status, payment_method, description,
              created_at::text, paid_at::text
         FROM payments
        WHERE billing_account_id = $1 AND status IN ('paid','refunded')
        ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 50`,
      [account.id],
    ),
  ]);

  return (
    <AccountStatementClient
      account={account}
      charges={chargesResult.rows.map((row) => ({ ...row, original_amount: Number(row.original_amount), outstanding_amount: Number(row.outstanding_amount) }))}
      payments={paymentsResult.rows.map((row) => ({ ...row, amount: Number(row.amount) }))}
      paymentResult={payment === "success" ? "success" : payment === "cancelled" ? "cancelled" : null}
    />
  );
}
