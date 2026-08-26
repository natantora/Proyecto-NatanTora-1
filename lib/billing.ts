import { createHash, randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canManageBilling } from "@/lib/permissions";

export type BillingAdmin = { user: AuthUser };

export async function requireBillingAdmin(): Promise<BillingAdmin | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = await getUserRole(user.id);
  return canManageBilling(role) ? { user } : null;
}

export function cleanText(value: unknown, max = 250): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

export function cleanEmail(value: unknown): string {
  return cleanText(value, 254).toLowerCase();
}

export function money(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  const normalized = cleanText(value)
    .replace(/[$\s]/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

export function manualReference(): string {
  return `MAN-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function derivedReference(parts: unknown[]): string {
  const source = parts.map((part) => cleanText(part).toLowerCase()).join("|");
  return `XLS-${createHash("sha256").update(source).digest("hex").slice(0, 16).toUpperCase()}`;
}

export async function linkMatchingProfile(client: PoolClient, accountId: string, email: string): Promise<void> {
  if (!email) return;
  await client.query(
    `INSERT INTO billing_account_members (account_id, profile_id)
     SELECT $1, id FROM profiles WHERE LOWER(email) = LOWER($2)
     ON CONFLICT (profile_id) DO NOTHING`,
    [accountId, email],
  );
}

export async function applyBillingPayment(client: PoolClient, paymentId: string, stripeIntent?: string | null): Promise<boolean> {
  const paymentResult = await client.query<{
    id: string;
    status: string;
    billing_applied_at: Date | null;
  }>(
    `SELECT id, status, billing_applied_at FROM payments WHERE id = $1 FOR UPDATE`,
    [paymentId],
  );
  const payment = paymentResult.rows[0];
  if (!payment || payment.billing_applied_at) return false;

  const allocations = await client.query<{ charge_id: string; amount: string }>(
    `SELECT charge_id, amount::text FROM billing_payment_allocations WHERE payment_id = $1 ORDER BY charge_id`,
    [paymentId],
  );
  if (!allocations.rowCount) throw new Error("El pago no tiene cargos asociados");

  for (const allocation of allocations.rows) {
    const charge = await client.query<{ outstanding_amount: string }>(
      `SELECT outstanding_amount::text FROM billing_charges WHERE id = $1 FOR UPDATE`,
      [allocation.charge_id],
    );
    if (!charge.rows[0]) throw new Error("Cargo no encontrado");
    const outstanding = Number(charge.rows[0].outstanding_amount);
    const amount = Number(allocation.amount);
    const remaining = Math.max(0, Math.round((outstanding - amount) * 100) / 100);
    await client.query(
      `UPDATE billing_charges
          SET outstanding_amount = $2,
              status = CASE WHEN $2 = 0 THEN 'paid' ELSE 'open' END,
              updated_at = NOW()
        WHERE id = $1`,
      [allocation.charge_id, remaining],
    );
  }

  await client.query(
    `UPDATE payments
        SET status = 'paid', paid_at = COALESCE(paid_at, NOW()),
            stripe_payment_intent = COALESCE($2, stripe_payment_intent),
            billing_applied_at = NOW()
      WHERE id = $1`,
    [paymentId, stripeIntent ?? null],
  );
  return true;
}
