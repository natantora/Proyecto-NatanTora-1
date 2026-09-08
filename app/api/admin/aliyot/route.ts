import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureAliyotSchema } from "@/lib/aliyot";
import { ALIYAH_READING_TYPES, PARASHOT, type AliyahReadingType } from "@/lib/aliyot-constants";
import { canManageAliyot, type Role } from "@/lib/permissions";

async function authorized() {
  const user = await getCurrentUser();
  return user && user.status === "approved" && canManageAliyot(user.role as Role) ? user : null;
}

function parsePayload(body: Record<string, unknown>) {
  const personName = String(body.person_name ?? "").trim();
  const occurredOn = String(body.occurred_on ?? "").trim();
  const readingType = String(body.reading_type ?? "") as AliyahReadingType;
  const parasha = String(body.parasha ?? "").trim();
  const hadDonation = body.had_donation === true;
  const amount = hadDonation ? Number(body.donation_amount) : null;
  const notes = String(body.notes ?? "").trim() || null;

  if (personName.length < 2 || personName.length > 120) throw new Error("Escribe el nombre completo");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) throw new Error("Selecciona una fecha válida");
  if (!(ALIYAH_READING_TYPES as readonly string[]).includes(readingType)) throw new Error("Selecciona el tipo de lectura");
  if (!(PARASHOT as readonly string[]).includes(parasha)) throw new Error("Selecciona una parashá válida");
  if (hadDonation && (!Number.isFinite(amount) || amount === null || amount <= 0 || amount > 10_000_000)) {
    throw new Error("Escribe el importe del donativo");
  }
  if (notes && notes.length > 500) throw new Error("Las notas son demasiado largas");

  return { personName, occurredOn, readingType, parasha, hadDonation, amount, notes };
}

export async function POST(request: NextRequest) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  try {
    await ensureAliyotSchema();
    const values = parsePayload(await request.json().catch(() => ({})));
    const result = await query(
      `INSERT INTO aliyot_records
         (person_name, occurred_on, reading_type, parasha, had_donation, donation_amount, notes, created_by)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [values.personName, values.occurredOn, values.readingType, values.parasha, values.hadDonation, values.amount, values.notes, user.id],
    );
    revalidatePath("/admin/aliyot");
    return NextResponse.json({ ok: true, id: result.rows[0]?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  try {
    await ensureAliyotSchema();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Registro inválido");
    const values = parsePayload(body);
    const result = await query(
      `UPDATE aliyot_records
          SET person_name = $1, occurred_on = $2::date, reading_type = $3,
              parasha = $4, had_donation = $5, donation_amount = $6,
              notes = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING id`,
      [values.personName, values.occurredOn, values.readingType, values.parasha, values.hadDonation, values.amount, values.notes, id],
    );
    if (!result.rowCount) return NextResponse.json({ error: "El registro ya no existe" }, { status: 404 });
    revalidatePath("/admin/aliyot");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Registro inválido" }, { status: 400 });
  await ensureAliyotSchema();
  const result = await query("DELETE FROM aliyot_records WHERE id = $1 RETURNING id", [id]);
  if (!result.rowCount) return NextResponse.json({ error: "El registro ya no existe" }, { status: 404 });
  revalidatePath("/admin/aliyot");
  return NextResponse.json({ ok: true });
}
