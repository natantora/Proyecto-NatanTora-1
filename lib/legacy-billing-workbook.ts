import ExcelJS from "exceljs";
import { cleanText, money } from "@/lib/billing";

export type LegacyAccount = { legacyId: string; name: string; reference: string; phone: string | null; expectedBalance: number };
export type LegacyCharge = { reference: string; accountLegacyId: string; concept: string; period: string | null; amount: number; outstanding: number; status: "open" | "paid"; notes: string | null; date: string };
export type LegacyPayment = { reference: string; accountLegacyId: string; amount: number; method: string; description: string; notes: string | null; date: string; metadata: Record<string, unknown> };
export type LegacyAllocation = { paymentReference: string; chargeReference: string; amount: number };

export type LegacyBillingWorkbook = {
  accounts: LegacyAccount[];
  charges: LegacyCharge[];
  payments: LegacyPayment[];
  allocations: LegacyAllocation[];
  warnings: string[];
  summary: {
    accounts: number; charges: number; payments: number; paidCharges: number; openCharges: number;
    chargeTotal: number; paymentTotal: number; openBalance: number; skippedCharges: number; skippedPayments: number;
  };
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function raw(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part: { text?: string }) => part.text || "").join("");
  }
  return value;
}

function key(value: unknown): string {
  return cleanText(raw(value), 300).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function text(value: ExcelJS.CellValue, limit = 300): string { return cleanText(raw(value), limit); }
function amount(value: ExcelJS.CellValue): number { return money(raw(value)) || 0; }

function date(value: ExcelJS.CellValue): string {
  const parsed = raw(value);
  if (parsed instanceof Date && !Number.isNaN(parsed.valueOf())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
  }
  const compact = cleanText(parsed, 30);
  const mx = compact.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (mx) return `${mx[3].length === 2 ? `20${mx[3]}` : mx[3]}-${mx[2].padStart(2, "0")}-${mx[1].padStart(2, "0")}`;
  return "2000-01-01";
}

function sequence(value: string): number {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function paymentMethod(value: string): string {
  const normalized = key(value);
  if (normalized.includes("EFECTIVO")) return "cash";
  if (normalized.includes("CHEQUE")) return "check";
  if (["CENTRAL PAY", "SANTANDER", "BBVA", "TRANSFERENCIA"].some((item) => normalized.includes(item))) return "bank_transfer";
  if (["AMEX", "TARJETA", "YKT"].some((item) => normalized.includes(item))) return "card";
  if (["GASTOS", "RETIRO", "AJUSTE"].some((item) => normalized.includes(item))) return "adjustment";
  return "other";
}

export async function parseLegacyBillingWorkbook(file: File): Promise<LegacyBillingWorkbook> {
  if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera 10 MB");
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error("Usa un archivo .xlsx o .xlsm");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const clientsSheet = workbook.getWorksheet("CLIENTES");
  const chargesSheet = workbook.getWorksheet("CARGOS");
  const paymentsSheet = workbook.getWorksheet("PAGOS");
  if (!clientsSheet || !chargesSheet || !paymentsSheet) throw new Error("El archivo necesita las pestañas CLIENTES, CARGOS y PAGOS");

  const accounts: LegacyAccount[] = [];
  const accountByName = new Map<string, LegacyAccount>();
  for (let rowNumber = 1; rowNumber <= clientsSheet.rowCount; rowNumber += 1) {
    const row = clientsSheet.getRow(rowNumber);
    const idValue = text(row.getCell(2).value, 30);
    const name = text(row.getCell(3).value, 160);
    const idNumber = Number(idValue);
    if (!name || !Number.isFinite(idNumber) || idNumber <= 0) continue;
    const legacyId = String(Math.trunc(idNumber));
    const phoneRaw = text(row.getCell(14).value, 40).replace(/\.0$/, "");
    const account: LegacyAccount = {
      legacyId,
      name,
      reference: text(row.getCell(6).value, 100) || `MNT-${legacyId.padStart(4, "0")}`,
      phone: phoneRaw || null,
      expectedBalance: amount(row.getCell(9).value),
    };
    accounts.push(account);
    accountByName.set(key(name), account);
  }
  if (!accounts.length) throw new Error("No se encontraron clientes válidos en la pestaña CLIENTES");

  const charges: LegacyCharge[] = [];
  let skippedCharges = 0;
  let orphanCharges = 0;
  for (let rowNumber = 4; rowNumber <= chargesSheet.rowCount; rowNumber += 1) {
    const row = chargesSheet.getRow(rowNumber);
    const reference = text(row.getCell(3).value, 100);
    const clientName = text(row.getCell(8).value, 160);
    const chargeAmount = amount(row.getCell(13).value);
    if (!reference && !clientName && !chargeAmount) continue;
    const account = accountByName.get(key(clientName));
    if (!account || chargeAmount <= 0) {
      skippedCharges += 1;
      if (!account && chargeAmount > 0) orphanCharges += 1;
      continue;
    }
    const conceptParts = [row.getCell(4).value, row.getCell(6).value, row.getCell(11).value, row.getCell(12).value]
      .map((value) => text(value, 100)).filter(Boolean);
    charges.push({
      reference,
      accountLegacyId: account.legacyId,
      concept: [...new Set(conceptParts)].join(" · ").slice(0, 180) || "Cargo histórico",
      period: text(row.getCell(15).value, 100) || text(row.getCell(5).value, 20) || null,
      amount: chargeAmount,
      outstanding: chargeAmount,
      status: "open",
      notes: text(row.getCell(17).value, 1000) || null,
      date: date(row.getCell(7).value),
    });
  }

  const payments: LegacyPayment[] = [];
  let skippedPayments = 0;
  for (let rowNumber = 2; rowNumber <= paymentsSheet.rowCount; rowNumber += 1) {
    const row = paymentsSheet.getRow(rowNumber);
    const reference = text(row.getCell(3).value, 100);
    const clientName = text(row.getCell(6).value, 160);
    const paymentAmount = amount(row.getCell(7).value);
    if (!reference && !clientName && !paymentAmount) continue;
    if (key(clientName).includes("TRASPASO DE CAJA")) { skippedPayments += 1; continue; }
    const account = accountByName.get(key(clientName));
    if (!account || paymentAmount <= 0 || !reference) { skippedPayments += 1; continue; }
    const originalMethod = text(row.getCell(10).value, 100);
    const cashbox = text(row.getCell(9).value, 100);
    const receivedBy = text(row.getCell(8).value, 100);
    const comments = text(row.getCell(12).value, 1000);
    payments.push({
      reference,
      accountLegacyId: account.legacyId,
      amount: paymentAmount,
      method: paymentMethod(originalMethod),
      description: "Pago histórico",
      notes: comments || null,
      date: date(row.getCell(4).value),
      metadata: { source: "COBRANZA MNT.xlsx", legacy_reference: reference, original_method: originalMethod || null, cashbox: cashbox || null, received_by: receivedBy || null },
    });
  }

  const allocations: LegacyAllocation[] = [];
  const chargesByAccount = new Map<string, LegacyCharge[]>();
  for (const charge of charges) {
    const group = chargesByAccount.get(charge.accountLegacyId) || [];
    group.push(charge); chargesByAccount.set(charge.accountLegacyId, group);
  }
  const paymentsByAccount = new Map<string, LegacyPayment[]>();
  for (const payment of payments) {
    const group = paymentsByAccount.get(payment.accountLegacyId) || [];
    group.push(payment); paymentsByAccount.set(payment.accountLegacyId, group);
  }
  for (const account of accounts) {
    const accountCharges = (chargesByAccount.get(account.legacyId) || []).sort((a, b) => sequence(a.reference) - sequence(b.reference));
    const accountPayments = (paymentsByAccount.get(account.legacyId) || []).sort((a, b) => a.date.localeCompare(b.date) || sequence(a.reference) - sequence(b.reference));
    let chargeIndex = 0;
    for (const payment of accountPayments) {
      let remaining = payment.amount;
      while (remaining > 0.001 && chargeIndex < accountCharges.length) {
        const charge = accountCharges[chargeIndex];
        if (charge.outstanding <= 0.001) { chargeIndex += 1; continue; }
        const applied = Math.min(remaining, charge.outstanding);
        charge.outstanding = Math.round((charge.outstanding - applied) * 100) / 100;
        remaining = Math.round((remaining - applied) * 100) / 100;
        allocations.push({ paymentReference: payment.reference, chargeReference: charge.reference, amount: applied });
        if (charge.outstanding <= 0.001) chargeIndex += 1;
      }
    }
    for (const charge of accountCharges) charge.status = charge.outstanding <= 0.001 ? "paid" : "open";
  }

  const chargeTotal = charges.reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const openBalance = charges.reduce((sum, item) => sum + item.outstanding, 0);
  const warnings: string[] = [];
  if (skippedCharges) warnings.push(`Se omitieron ${skippedCharges} filas de cargos sin importe o sin cliente identificable.`);
  if (orphanCharges) warnings.push(`${orphanCharges} cargos con importe no tenían cliente y no se asignaron a otra persona.`);
  if (skippedPayments) warnings.push(`Se omitieron ${skippedPayments} movimientos internos, negativos o sin cliente identificable.`);
  const expectedOpen = accounts.reduce((sum, item) => sum + Math.max(0, item.expectedBalance), 0);
  if (Math.abs(expectedOpen - openBalance) > 0.02) throw new Error(`Los saldos no cuadran con CLIENTES (diferencia ${Math.abs(expectedOpen - openBalance).toFixed(2)})`);

  return {
    accounts, charges, payments, allocations, warnings,
    summary: {
      accounts: accounts.length, charges: charges.length, payments: payments.length,
      paidCharges: charges.filter((item) => item.status === "paid").length,
      openCharges: charges.filter((item) => item.status === "open").length,
      chargeTotal, paymentTotal, openBalance, skippedCharges, skippedPayments,
    },
  };
}
