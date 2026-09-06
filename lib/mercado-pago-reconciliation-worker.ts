import { query } from "@/lib/db";
import { finalizeMercadoPagoPayment } from "@/lib/mercado-pago-processing";
import { reportSystemAlert } from "@/lib/system-alerts";

const CHECK_INTERVAL_MS = 2 * 60 * 1000;
const BATCH_SIZE = 100;

declare global {
  var natantoraMercadoPagoReconciliationTimer: ReturnType<typeof setInterval> | undefined;
  var natantoraMercadoPagoReconciliationRunning: boolean | undefined;
}

export async function reconcileStoredMercadoPagoApprovals(): Promise<number> {
  if (global.natantoraMercadoPagoReconciliationRunning) return 0;
  global.natantoraMercadoPagoReconciliationRunning = true;
  try {
    const result = await query<{ id: string; mercadopago_payment_id: string }>(
      `SELECT id, mercadopago_payment_id
         FROM payments
        WHERE payment_method = 'mercadopago'
          AND provider_status = 'approved'
          AND status IN ('pending', 'failed')
          AND mercadopago_payment_id IS NOT NULL
        ORDER BY provider_updated_at NULLS FIRST, created_at
        LIMIT $1`,
      [BATCH_SIZE],
    );
    let reconciled = 0;
    for (const payment of result.rows) {
      try {
        if (await finalizeMercadoPagoPayment(payment.id, payment.mercadopago_payment_id)) reconciled += 1;
      } catch (error) {
        console.error(`[mercadopago/reconciliation] ${payment.id}:`, error);
        await reportSystemAlert({ severity: "critical", category: "payments", title: "Falló la conciliación de un pago aprobado", message: error instanceof Error ? error.message : String(error), fingerprint: `mercadopago:reconciliation:${payment.id}`, context: { payment_id: payment.id, provider_payment_id: payment.mercadopago_payment_id } });
      }
    }
    if (reconciled) console.info(`[mercadopago/reconciliation] ${reconciled} pagos aprobados conciliados`);
    return reconciled;
  } finally {
    global.natantoraMercadoPagoReconciliationRunning = false;
  }
}

export function startMercadoPagoReconciliationWorker(): void {
  if (global.natantoraMercadoPagoReconciliationTimer || !process.env.DATABASE_URL) return;
  const run = () => { void reconcileStoredMercadoPagoApprovals().catch(async (error) => {
    console.error("[mercadopago/reconciliation] ciclo fallido:", error);
    await reportSystemAlert({ severity: "critical", category: "payments", title: "Falló la conciliación de Mercado Pago", message: error instanceof Error ? error.message : String(error), fingerprint: "mercadopago:reconciliation-worker" });
  }); };
  run();
  global.natantoraMercadoPagoReconciliationTimer = setInterval(run, CHECK_INTERVAL_MS);
  global.natantoraMercadoPagoReconciliationTimer.unref();
  console.info("[mercadopago/reconciliation] revisión automática iniciada cada 2 minutos");
}
