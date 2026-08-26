import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { cleanEmail, cleanText, derivedReference, money, requireBillingAdmin } from "@/lib/billing";
import { query } from "@/lib/db";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

function normalizeHeader(value: unknown): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return value;
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const text = cleanText(value, 30);
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mx = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mx) return `${mx[3]}-${mx[2].padStart(2, "0")}-${mx[1].padStart(2, "0")}`;
  return null;
}

export async function POST(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona un archivo Excel" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "El archivo supera 5 MB" }, { status: 400 });
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    return NextResponse.json({ error: "Usa un archivo .xlsx o .xlsm" }, { status: 400 });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) return NextResponse.json({ error: "El Excel no contiene datos" }, { status: 400 });

    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(normalizeHeader(cellValue(cell.value)), column));
    const aliases: Record<string, string[]> = {
      reference: ["referencia", "id", "folio", "numero", "numero_de_cuenta"],
      name: ["nombre", "nombre_completo", "persona", "titular"],
      email: ["correo", "email", "correo_electronico"],
      phone: ["telefono", "celular", "movil"],
      concept: ["concepto", "descripcion", "donativo"],
      period: ["periodo", "mes", "ciclo"],
      amount: ["importe", "monto", "saldo", "cantidad"],
      dueDate: ["fecha_limite", "vencimiento", "fecha_de_vencimiento"],
      notes: ["notas", "observaciones", "comentarios"],
    };
    const column = (key: string) => aliases[key].map((alias) => headers.get(alias)).find(Boolean);
    if (!column("name") || !column("concept") || !column("amount")) {
      return NextResponse.json(
        { error: "El Excel necesita las columnas Nombre, Concepto e Importe" },
        { status: 400 },
      );
    }

    const accountResult = await query<{
      id: string; display_name: string; email: string | null; external_reference: string | null;
    }>("SELECT id, display_name, email, external_reference FROM billing_accounts WHERE active = TRUE");
    const byEmail = new Map(accountResult.rows.filter((a) => a.email).map((a) => [a.email!.toLowerCase(), a]));
    const byReference = new Map(accountResult.rows.filter((a) => a.external_reference).map((a) => [a.external_reference!.toLowerCase(), a]));

    const rows: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    for (let rowNumber = 2; rowNumber <= Math.min(sheet.rowCount, MAX_ROWS + 1); rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const get = (key: string) => {
        const col = column(key);
        return col ? cellValue(row.getCell(col).value) : null;
      };
      const name = cleanText(get("name"), 160);
      const concept = cleanText(get("concept"), 180);
      const amount = money(get("amount"));
      const email = cleanEmail(get("email"));
      const suppliedReference = cleanText(get("reference"), 100);
      if (!name && !concept && !amount && !email && !suppliedReference) continue;
      if (!name || !concept || !amount) {
        errors.push(`Fila ${rowNumber}: faltan nombre, concepto o importe válido`);
        continue;
      }
      const period = cleanText(get("period"), 100);
      const reference = derivedReference([suppliedReference || email || name, concept, period, amount]);
      const match = byReference.get(suppliedReference.toLowerCase()) || byEmail.get(email);
      rows.push({
        row_number: rowNumber,
        reference,
        account_reference: suppliedReference,
        name,
        email,
        phone: cleanText(get("phone"), 40),
        concept,
        period,
        amount,
        due_date: dateValue(get("dueDate")),
        notes: cleanText(get("notes"), 1000),
        account_id: match?.id ?? "",
        match_label: match ? `${match.display_name}${match.email ? ` · ${match.email}` : ""}` : null,
      });
    }
    if (sheet.rowCount > MAX_ROWS + 1) errors.push(`Solo se procesaron las primeras ${MAX_ROWS} filas`);
    return NextResponse.json({ filename: file.name, rows, errors });
  } catch (error) {
    console.error("[billing/import/preview]", error);
    return NextResponse.json({ error: "No se pudo leer el archivo Excel" }, { status: 400 });
  }
}
