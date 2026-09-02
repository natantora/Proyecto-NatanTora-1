import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const navy = rgb(0.07, 0.13, 0.27);
const gold = rgb(0.72, 0.52, 0.22);
const ink = rgb(0.25, 0.23, 0.2);
const pale = rgb(0.97, 0.94, 0.86);

function money(value: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function fit(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function header(page: PDFPage, bold: PDFFont, regular: PDFFont, title: string, subtitle: string) {
  const { width, height } = page.getSize();
  const safeSubtitle = fit(subtitle, 82);
  page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: navy });
  page.drawText("MIDRASH NATAN TORA", { x: 42, y: height - 40, size: 15, font: bold, color: gold });
  page.drawText(title, { x: 42, y: height - 66, size: 12, font: regular, color: rgb(1, 1, 1) });
  page.drawText(safeSubtitle, { x: width - 42 - regular.widthOfTextAtSize(safeSubtitle, 8), y: height - 40, size: 8, font: regular, color: rgb(0.75, 0.77, 0.82) });
}

export async function createReceiptPdf(input: {
  id: string; name: string; email: string | null; amount: number; method: string;
  paidAt: Date; description: string; concepts: string[]; status: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  header(page, bold, regular, "COMPROBANTE DE PAGO", input.paidAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }));
  page.drawText("Pago confirmado", { x: 42, y: 700, size: 12, font: bold, color: rgb(0.1, 0.48, 0.25) });
  page.drawText(money(input.amount), { x: 42, y: 650, size: 34, font: bold, color: navy });
  const rows = [
    ["Titular", input.name], ["Correo", input.email || "Sin correo"],
    ["Concepto", input.description], ["Aplicado a", input.concepts.join(", ") || input.description],
    ["Metodo", input.method], ["Fecha", input.paidAt.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })],
    ["Folio", input.id],
  ];
  let y = 590;
  for (const [label, value] of rows) {
    page.drawLine({ start: { x: 42, y: y - 10 }, end: { x: 553, y: y - 10 }, thickness: 0.5, color: rgb(0.82, 0.78, 0.68) });
    page.drawText(label.toUpperCase(), { x: 42, y, size: 8, font: bold, color: gold });
    page.drawText(fit(value, 75), { x: 155, y, size: 10, font: regular, color: ink });
    y -= 46;
  }
  page.drawRectangle({ x: 42, y: 130, width: 511, height: 70, color: pale });
  page.drawText("Este comprobante acredita un pago registrado en Natán Torá.", { x: 58, y: 170, size: 10, font: bold, color: navy });
  page.drawText("Conserva el folio para cualquier aclaración.", { x: 58, y: 150, size: 9, font: regular, color: ink });
  page.drawText("natantora.com", { x: 42, y: 65, size: 9, font: bold, color: gold });
  return pdf.save();
}

export type FinancialReportPayment = {
  id: string; date: Date; name: string; email: string; kind: string; description: string;
  amount: number; status: string; method: string; providerStatus: string;
};

export type FinancialReportAccount = {
  name: string; email: string; reference: string; balance: number; paid: number;
};

export async function createFinancialReportPdf(payments: FinancialReportPayment[], accounts: FinancialReportAccount[], filters: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const addPage = () => { const page = pdf.addPage([841.89, 595.28]); header(page, bold, regular, "REPORTE FINANCIERO", filters); return page; };
  let page = addPage();
  let y = 470;
  const total = payments.filter((item) => item.status === "Aprobado" || item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  page.drawText(`Movimientos: ${payments.length}`, { x: 38, y: 490, size: 10, font: bold, color: navy });
  page.drawText(`Total aprobado: ${money(total)}`, { x: 180, y: 490, size: 10, font: bold, color: navy });
  const columns = [38, 110, 250, 385, 500, 585, 665, 745];
  const widths = [10, 22, 21, 18, 13, 12, 12, 12];
  const drawHeading = () => {
    page.drawRectangle({ x: 32, y: y - 8, width: 778, height: 26, color: pale });
    ["Fecha", "Persona", "Concepto", "Tipo", "Importe", "Estado", "Metodo", "Proveedor"].forEach((label, index) => page.drawText(label, { x: columns[index], y, size: 7, font: bold, color: navy }));
    y -= 29;
  };
  drawHeading();
  for (const payment of payments) {
    if (y < 40) { page = addPage(); y = 470; drawHeading(); }
    const values = [payment.date.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }), payment.name || payment.email, payment.description, payment.kind, money(payment.amount), payment.status, payment.method, payment.providerStatus || "-"];
    values.forEach((value, index) => page.drawText(fit(value, widths[index]), { x: columns[index], y, size: 7.2, font: regular, color: ink }));
    page.drawLine({ start: { x: 32, y: y - 7 }, end: { x: 810, y: y - 7 }, thickness: 0.35, color: rgb(0.86, 0.84, 0.8) });
    y -= 23;
  }
  page = addPage();
  y = 470;
  page.drawText(`Cuentas activas: ${accounts.length}`, { x: 38, y: 490, size: 10, font: bold, color: navy });
  const accountColumns = [38, 230, 420, 560, 680];
  const accountWidths = [30, 30, 20, 16, 16];
  const drawAccountHeading = () => {
    page.drawRectangle({ x: 32, y: y - 8, width: 778, height: 26, color: pale });
    ["Persona", "Correo", "Referencia", "Saldo pendiente", "Total pagado"].forEach((label, index) => page.drawText(label, { x: accountColumns[index], y, size: 7, font: bold, color: navy }));
    y -= 29;
  };
  drawAccountHeading();
  for (const account of accounts) {
    if (y < 40) { page = addPage(); y = 470; drawAccountHeading(); }
    const values = [account.name, account.email || "-", account.reference || "-", money(account.balance), money(account.paid)];
    values.forEach((value, index) => page.drawText(fit(value, accountWidths[index]), { x: accountColumns[index], y, size: 7.2, font: regular, color: ink }));
    page.drawLine({ start: { x: 32, y: y - 7 }, end: { x: 810, y: y - 7 }, thickness: 0.35, color: rgb(0.86, 0.84, 0.8) });
    y -= 23;
  }
  return pdf.save();
}
