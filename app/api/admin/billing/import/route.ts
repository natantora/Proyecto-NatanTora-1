import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { cleanEmail, cleanText, linkMatchingProfile, money, requireBillingAdmin } from "@/lib/billing";
import { transaction } from "@/lib/db";

type ImportRow = {
  reference?: unknown;
  account_reference?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  concept?: unknown;
  period?: unknown;
  amount?: unknown;
  due_date?: unknown;
  notes?: unknown;
  account_id?: unknown;
};

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const filename = cleanText(body.filename, 255) || "importacion.xlsx";
  const rows = Array.isArray(body.rows) ? (body.rows as ImportRow[]).slice(0, 5000) : [];
  if (!rows.length) return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });

  try {
    const summary = await transaction(async (client) => {
      const importResult = await client.query<{ id: string }>(
        `INSERT INTO billing_imports (filename, imported_by, total_rows)
         VALUES ($1, $2, $3) RETURNING id`,
        [filename, admin.user.id, rows.length],
      );
      const importId = importResult.rows[0].id;
      let imported = 0;
      let duplicates = 0;
      let errors = 0;

      for (const raw of rows) {
        const name = cleanText(raw.name, 160);
        const email = cleanEmail(raw.email) || null;
        const phone = cleanText(raw.phone, 40) || null;
        const reference = cleanText(raw.reference, 100);
        const accountReference = cleanText(raw.account_reference, 100) || null;
        const concept = cleanText(raw.concept, 180);
        const period = cleanText(raw.period, 100) || null;
        const amount = money(raw.amount);
        const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.due_date ?? "")) ? String(raw.due_date) : null;
        const notes = cleanText(raw.notes, 1000) || null;
        let accountId = cleanText(raw.account_id, 80);
        if (!name || !reference || !concept || !amount) { errors += 1; continue; }

        if (accountId) {
          const exists = await client.query("SELECT 1 FROM billing_accounts WHERE id = $1 AND active = TRUE", [accountId]);
          if (!exists.rowCount) { errors += 1; continue; }
        } else {
          const existing = await client.query<{ id: string }>(
            `SELECT id FROM billing_accounts
              WHERE ($1::text IS NOT NULL AND LOWER(external_reference) = LOWER($1))
                 OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
              ORDER BY created_at LIMIT 1`,
            [accountReference, email],
          );
          if (existing.rows[0]) accountId = existing.rows[0].id;
          else {
            const created = await client.query<{ id: string }>(
              `INSERT INTO billing_accounts
                (display_name, email, phone, external_reference, created_by)
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [name, email, phone, accountReference, admin.user.id],
            );
            accountId = created.rows[0].id;
            if (email) await linkMatchingProfile(client, accountId, email);
          }
        }

        const charge = await client.query(
          `INSERT INTO billing_charges
            (account_id, import_id, external_reference, concept, period,
             original_amount, outstanding_amount, source, due_date, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $6, 'excel', $7, $8, $9)
           ON CONFLICT (account_id, external_reference) DO NOTHING
           RETURNING id`,
          [accountId, importId, reference, concept, period, amount, dueDate, notes, admin.user.id],
        );
        if (charge.rowCount) imported += 1;
        else duplicates += 1;
      }

      await client.query(
        `UPDATE billing_imports
            SET imported_rows = $2, duplicate_rows = $3, error_rows = $4
          WHERE id = $1`,
        [importId, imported, duplicates, errors],
      );
      return { import_id: importId, imported, duplicates, errors };
    });
    revalidatePath("/admin/accounts");
    revalidatePath("/mi-cuenta");
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[billing/import]", error);
    return NextResponse.json({ error: "No se pudo completar la importación" }, { status: 500 });
  }
}
