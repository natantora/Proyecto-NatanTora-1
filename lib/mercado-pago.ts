import { createHmac, timingSafeEqual } from "crypto";
import { siteOrigin } from "@/lib/site-url";

const API_URL = "https://api.mercadopago.com";

export function mercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado");
  return token;
}

async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[mercadopago]", path, response.status, payload);
    throw new Error("Mercado Pago rechazó la operación");
  }
  return payload as T;
}

export async function createMercadoPagoPreference(params: {
  paymentId: string;
  title: string;
  description?: string;
  amount: number;
  email: string;
  kind: "billing" | "donation" | "event";
  returnPath: string;
  expirationMinutes?: number;
}): Promise<{ id: string; url: string }> {
  const origin = siteOrigin();
  const internal = encodeURIComponent(params.paymentId);
  const base = `${origin}${params.returnPath}`;
  const result = await mercadoPagoRequest<{ id: string; init_point?: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": params.paymentId },
    body: JSON.stringify({
      items: [{
        id: params.paymentId,
        title: params.title,
        description: params.description,
        quantity: 1,
        currency_id: "MXN",
        unit_price: params.amount,
      }],
      payer: { email: params.email },
      external_reference: params.paymentId,
      metadata: { payment_id: params.paymentId, payment_kind: params.kind },
      back_urls: {
        success: `${base}?payment=success&internal_payment_id=${internal}`,
        pending: `${base}?payment=pending&internal_payment_id=${internal}`,
        failure: `${base}?payment=cancelled&internal_payment_id=${internal}`,
      },
      auto_return: "approved",
      notification_url: `${origin}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + (params.expirationMinutes ?? 30) * 60 * 1000).toISOString(),
    }),
  });
  if (!result.id || !result.init_point) throw new Error("Mercado Pago no devolvió una página de pago");
  return { id: String(result.id), url: result.init_point };
}

export type MercadoPagoPayment = {
  id: number | string;
  status: string;
  status_detail?: string | null;
  date_last_updated?: string | null;
  external_reference?: string | null;
  metadata?: { payment_id?: string; payment_kind?: string };
};

export function getMercadoPagoPayment(id: string): Promise<MercadoPagoPayment> {
  return mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

export function verifyMercadoPagoSignature(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret || !params.signature) return false;
  const parts = Object.fromEntries(params.signature.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
  if (!parts.ts || !parts.v1) return false;

  // Mercado Pago signs only the values that are present in the incoming URL
  // and headers. A data ID found only in the JSON body must not be added to
  // the manifest, otherwise legitimate notifications fail validation.
  const manifest = [
    params.dataId ? `id:${params.dataId.toLowerCase()};` : "",
    params.requestId ? `request-id:${params.requestId};` : "",
    `ts:${parts.ts};`,
  ].join("");
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const received = parts.v1.toLowerCase();
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
