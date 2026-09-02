import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireBillingAdmin } from "@/lib/billing";
import { query } from "@/lib/db";
import { createFinancialReportPdf, type FinancialReportAccount, type FinancialReportPayment } from "@/lib/financial-pdf";

type Row = { id: string; amount: string; status: string; payment_method: string | null; donor_name: string | null; donor_email: string | null; description: string | null; metadata: Record<string, unknown>; provider_status: string | null; created_at: Date; paid_at: Date | null; account_name: string | null; event_title: string | null };

function safeDate(value: string | null): string | null { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function filename(ext: string) { return `reporte-financiero-${new Date().toISOString().slice(0, 10)}.${ext}`; }
function labelKind(value: string) { return ({ billing: "Estado de cuenta", donation: "Donativo", event: "Evento", seat: "Asiento" } as Record<string, string>)[value] || "Pago"; }
function labelStatus(value: string) { return ({ paid: "Aprobado", pending: "Pendiente", failed: "Fallido", refunded: "Reembolsado", charged_back: "Contracargo" } as Record<string, string>)[value] || value; }
function labelMethod(value: string | null) { return ({ cash: "Efectivo", mercadopago: "Mercado Pago", stripe: "Stripe" } as Record<string, string>)[value || ""] || value || "-"; }

export async function GET(req: NextRequest) {
  const admin = await requireBillingAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const from = safeDate(req.nextUrl.searchParams.get("from"));
  const to = safeDate(req.nextUrl.searchParams.get("to"));
  const person = (req.nextUrl.searchParams.get("person") || "").trim().slice(0, 120);
  const eventId = (req.nextUrl.searchParams.get("event_id") || "").trim();
  const requestedMethod = req.nextUrl.searchParams.get("method") || "";
  const method = ["cash", "mercadopago", "stripe"].includes(requestedMethod) ? requestedMethod : "";
  const values: unknown[] = [];
  const conditions: string[] = [];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (from) conditions.push(`COALESCE(payment.paid_at, payment.created_at) >= ${add(`${from}T00:00:00-06:00`)}::timestamptz`);
  if (to) conditions.push(`COALESCE(payment.paid_at, payment.created_at) < (${add(`${to}T00:00:00-06:00`)}::timestamptz + INTERVAL '1 day')`);
  if (person) conditions.push(`(COALESCE(account.display_name, payment.donor_name, '') ILIKE ${add(`%${person}%`)} OR COALESCE(payment.donor_email, '') ILIKE ${add(`%${person}%`)})`);
  if (eventId) conditions.push(`payment.metadata->>'event_id' = ${add(eventId)}`);
  if (method) conditions.push(`payment.payment_method = ${add(method)}`);
  const result = await query<Row>(`SELECT payment.id, payment.amount::text, payment.status, payment.payment_method,
    payment.donor_name, payment.donor_email, payment.description, payment.metadata, payment.provider_status,
    payment.created_at, payment.paid_at, account.display_name AS account_name, event.title AS event_title
    FROM payments payment LEFT JOIN billing_accounts account ON account.id = payment.billing_account_id
    LEFT JOIN events event ON event.id::text = payment.metadata->>'event_id'
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY COALESCE(payment.paid_at, payment.created_at) DESC LIMIT 10000`, values);
  const payments: FinancialReportPayment[] = result.rows.map((row) => ({
    id: row.id, date: new Date(row.paid_at ?? row.created_at), name: row.account_name || row.donor_name || "Sin nombre",
    email: row.donor_email || "", kind: labelKind(typeof row.metadata?.kind === "string" ? row.metadata.kind : "pago"),
    description: row.event_title || row.description || "Pago", amount: Number(row.amount), status: labelStatus(row.status),
    method: labelMethod(row.payment_method), providerStatus: row.provider_status || "",
  }));
  const accountsResult = await query<{ display_name: string; email: string | null; phone: string | null; external_reference: string | null; balance: string; paid: string }>(`SELECT account.display_name, account.email, account.phone, account.external_reference,
    COALESCE(SUM(charge.outstanding_amount) FILTER (WHERE charge.status = 'open'), 0)::text AS balance,
    COALESCE((SELECT SUM(payment.amount) FROM payments payment WHERE payment.billing_account_id = account.id AND payment.status = 'paid'), 0)::text AS paid
    FROM billing_accounts account LEFT JOIN billing_charges charge ON charge.account_id = account.id
    WHERE account.active = TRUE AND ($1::text = '' OR account.display_name ILIKE '%' || $1 || '%' OR COALESCE(account.email, '') ILIKE '%' || $1 || '%')
    GROUP BY account.id ORDER BY account.display_name`, [person]);
  const accounts: FinancialReportAccount[] = accountsResult.rows.map((account) => ({
    name: account.display_name, email: account.email || "", reference: account.external_reference || "", balance: Number(account.balance), paid: Number(account.paid),
  }));
  const filterLabel = [from && `Desde ${from}`, to && `Hasta ${to}`, person && `Persona: ${person}`, method && `Método: ${labelMethod(method)}`].filter(Boolean).join(" | ") || "Todos los movimientos";
  if (format === "pdf") {
    const bytes = await createFinancialReportPdf(payments, accounts, filterLabel);
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename("pdf")}"`, "Cache-Control": "private, no-store" } });
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Midrash Natán Torá";
  const paymentsSheet = workbook.addWorksheet("Pagos", { views: [{ state: "frozen", ySplit: 4 }] });
  paymentsSheet.mergeCells("A1:J1"); paymentsSheet.getCell("A1").value = "MIDRASH NATÁN TORÁ - REPORTE FINANCIERO";
  paymentsSheet.getCell("A1").font = { bold: true, color: { argb: "FFF3E6C8" }, size: 16 }; paymentsSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF142544" } }; paymentsSheet.getCell("A1").alignment = { vertical: "middle" }; paymentsSheet.getRow(1).height = 30;
  paymentsSheet.mergeCells("A2:J2"); paymentsSheet.getCell("A2").value = filterLabel;
  paymentsSheet.addRow([]);
  paymentsSheet.addRow(["Fecha", "Persona", "Correo", "Tipo", "Concepto", "Importe", "Estado", "Método", "Estado proveedor", "Folio"]);
  for (const item of payments) paymentsSheet.addRow([item.date, item.name, item.email, item.kind, item.description, item.amount, item.status, item.method, item.providerStatus, item.id]);
  paymentsSheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } }; paymentsSheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBD9040" } };
  paymentsSheet.autoFilter = { from: "A4", to: "J4" };
  paymentsSheet.getColumn(1).numFmt = "yyyy-mm-dd hh:mm"; paymentsSheet.getColumn(6).numFmt = '"$"#,##0.00';
  [18, 24, 28, 18, 36, 15, 16, 18, 20, 38].forEach((width, index) => { paymentsSheet.getColumn(index + 1).width = width; });

  const accountSheet = workbook.addWorksheet("Cuentas");
  accountSheet.addRow(["Persona", "Correo", "Teléfono", "Referencia", "Saldo pendiente", "Total pagado"]);
  for (const account of accountsResult.rows) accountSheet.addRow([account.display_name, account.email, account.phone, account.external_reference, Number(account.balance), Number(account.paid)]);
  accountSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; accountSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF142544" } };
  accountSheet.autoFilter = { from: "A1", to: "F1" }; accountSheet.views = [{ state: "frozen", ySplit: 1 }];
  [26, 30, 18, 20, 18, 18].forEach((width, index) => { accountSheet.getColumn(index + 1).width = width; }); accountSheet.getColumn(5).numFmt = '"$"#,##0.00'; accountSheet.getColumn(6).numFmt = '"$"#,##0.00';
  const output = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename("xlsx")}"`, "Cache-Control": "private, no-store" } });
}
