import { query } from "@/lib/db";
import { failPendingPayment } from "@/lib/payment-processing";
import { reportSystemAlert } from "@/lib/system-alerts";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const BATCH_SIZE = 100;
const MAX_BATCHES_PER_CYCLE = 10;

declare global {
  // Evita iniciar más de un reloj si Next.js vuelve a cargar el módulo.
  var natantoraPaymentExpiryTimer: ReturnType<typeof setInterval> | undefined;
  var natantoraPaymentExpiryRunning: boolean | undefined;
}

export async function expireStalePayments(): Promise<number> {
  if (global.natantoraPaymentExpiryRunning) return 0;
  global.natantoraPaymentExpiryRunning = true;
  let expired = 0;
  try {
    for (let batch = 0; batch < MAX_BATCHES_PER_CYCLE; batch += 1) {
      const result = await query<{ id: string }>(
        `SELECT id
           FROM payments
          WHERE status = 'pending'
            AND expires_at IS NOT NULL
            AND expires_at <= NOW()
          ORDER BY expires_at
          LIMIT $1`,
        [BATCH_SIZE],
      );
      if (!result.rowCount) break;
      await Promise.all(result.rows.map((payment) => failPendingPayment(payment.id)));
      expired += result.rows.length;
      if (result.rows.length < BATCH_SIZE) break;
    }
    if (expired) console.info(`[payments/expiry] ${expired} pagos vencidos procesados`);
    return expired;
  } finally {
    global.natantoraPaymentExpiryRunning = false;
  }
}

export function startPaymentExpiryWorker(): void {
  if (global.natantoraPaymentExpiryTimer || !process.env.DATABASE_URL) return;
  const run = () => { void expireStalePayments().catch(async (error) => {
    console.error("[payments/expiry] ciclo fallido:", error);
    await reportSystemAlert({ severity: "critical", category: "payments", title: "Falló la revisión de pagos vencidos", message: error instanceof Error ? error.message : String(error), fingerprint: "payments:expiry-worker" });
  }); };
  run();
  global.natantoraPaymentExpiryTimer = setInterval(run, CHECK_INTERVAL_MS);
  global.natantoraPaymentExpiryTimer.unref();
  console.info("[payments/expiry] revisión automática iniciada cada 5 minutos");
}
