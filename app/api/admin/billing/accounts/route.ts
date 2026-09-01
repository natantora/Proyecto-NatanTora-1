import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { cleanEmail, cleanText, linkMatchingProfile, requireBillingAdmin } from "@/lib/billing";
import { transaction } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const displayName = cleanText(body.display_name, 160);
  const email = cleanEmail(body.email) || null;
  const phone = cleanText(body.phone, 40) || null;
  const externalReference = cleanText(body.external_reference, 100) || null;
  const notes = cleanText(body.notes, 1000) || null;
  const profileId = cleanText(body.profile_id, 80) || null;
  if (!displayName) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  try {
    const account = await transaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO billing_accounts
          (display_name, email, phone, external_reference, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [displayName, email, phone, externalReference, notes, admin.user.id],
      );
      const accountId = result.rows[0].id;
      if (profileId) {
        await client.query(
          `INSERT INTO billing_account_members (account_id, profile_id) VALUES ($1, $2)`,
          [accountId, profileId],
        );
      } else if (email) {
        await linkMatchingProfile(client, accountId, email);
      }
      return { id: accountId };
    });
    revalidatePath("/admin/accounts");
    return NextResponse.json({ ok: true, account });
  } catch (error: unknown) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "La referencia o el miembro ya están asociados a otra cuenta" : "No se pudo crear la cuenta" },
      { status: duplicate ? 409 : 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const accountId = cleanText(body.account_id, 80);
  const profileId = cleanText(body.profile_id, 80);
  if (!accountId) return NextResponse.json({ error: "Cuenta inválida" }, { status: 400 });
  try {
    await transaction(async (client) => {
      await client.query("DELETE FROM billing_account_members WHERE account_id = $1", [accountId]);
      if (profileId) {
        await client.query(
          `INSERT INTO billing_account_members (account_id, profile_id) VALUES ($1, $2)`,
          [accountId, profileId],
        );
      }
    });
    revalidatePath("/admin/accounts");
    revalidatePath("/mi-cuenta");
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "Ese miembro ya está vinculado a otra cuenta" : "No se pudo actualizar la vinculación" },
      { status: duplicate ? 409 : 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const accountId = cleanText(body.account_id, 80);
  if (!accountId) return NextResponse.json({ error: "Cuenta inválida" }, { status: 400 });

  try {
    await transaction(async (client) => {
      const account = await client.query<{ id: string }>(
        "SELECT id FROM billing_accounts WHERE id = $1 FOR UPDATE",
        [accountId],
      );
      if (!account.rows[0]) throw new Error("Cuenta no encontrada");

      const history = await client.query<{ payments: string; applied_charges: string }>(
        `SELECT
           (SELECT COUNT(*)::text FROM payments WHERE billing_account_id = $1) AS payments,
           (SELECT COUNT(*)::text FROM billing_charges
             WHERE account_id = $1
               AND (status <> 'open' OR outstanding_amount <> original_amount)) AS applied_charges`,
        [accountId],
      );
      if (Number(history.rows[0].payments) > 0 || Number(history.rows[0].applied_charges) > 0) {
        throw new Error("Esta cuenta tiene historial de pagos y debe conservarse para la contabilidad");
      }
      await client.query("DELETE FROM billing_accounts WHERE id = $1", [accountId]);
    });
    revalidatePath("/admin/accounts");
    revalidatePath("/mi-cuenta");
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar la cuenta";
    const known = message === "Cuenta no encontrada" || message.includes("historial de pagos");
    return NextResponse.json({ error: known ? message : "No se pudo eliminar la cuenta" }, { status: known ? 409 : 500 });
  }
}
