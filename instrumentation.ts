export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { startPaymentExpiryWorker } = await import("@/lib/payment-expiry-worker");
  startPaymentExpiryWorker();
}
