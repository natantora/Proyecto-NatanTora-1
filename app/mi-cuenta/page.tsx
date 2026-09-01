import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import AccountStatementClient from "./AccountStatementClient";
import { mercadoPagoConfigured } from "@/lib/mercado-pago";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; session_id?: string; internal_payment_id?: string; payment_id?: string }>;
}) {
  const { payment, session_id, internal_payment_id, payment_id } = await searchParams;
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

  const [allChargesResult, paymentsResult] = await Promise.all([
    query<{
      id: string; concept: string; period: string | null; original_amount: string;
      outstanding_amount: string; status: "open" | "paid" | "waived"; due_date: string | null; notes: string | null; created_at: string;
    }>(
      `SELECT id, concept, period, original_amount::text, outstanding_amount::text,
              status, due_date::text, notes, created_at::text
         FROM billing_charges
        WHERE account_id = $1
        ORDER BY created_at DESC`,
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

  const allCharges = allChargesResult.rows.map((row) => ({
    ...row,
    original_amount: Number(row.original_amount),
    outstanding_amount: Number(row.outstanding_amount),
  }));
  const openCharges = allCharges.filter((charge) => charge.status === "open" && charge.outstanding_amount > 0);

  return (
    <AccountStatementClient
      account={account}
      charges={openCharges}
      allCharges={allCharges}
      payments={paymentsResult.rows.map((row) => ({ ...row, amount: Number(row.amount) }))}
      paymentResult={payment === "success" ? "success" : payment === "cancelled" ? "cancelled" : null}
      sessionId={session_id || null}
      internalPaymentId={internal_payment_id || null}
      providerPaymentId={payment_id || null}
      cardPaymentsEnabled={mercadoPagoConfigured() || stripeConfigured()}
    />
  );
}
