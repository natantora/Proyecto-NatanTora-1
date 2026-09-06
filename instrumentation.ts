export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { startPaymentExpiryWorker } = await import("@/lib/payment-expiry-worker");
  const { startMercadoPagoReconciliationWorker } = await import("@/lib/mercado-pago-reconciliation-worker");
  const { startDatabaseBackupWorker } = await import("@/lib/database-backup-worker");
  startPaymentExpiryWorker();
  startMercadoPagoReconciliationWorker();
  startDatabaseBackupWorker();
}
