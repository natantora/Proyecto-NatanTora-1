"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Charge = { id: string; concept: string; period: string | null; original_amount: number; outstanding_amount: number; status: "open" | "paid" | "waived"; due_date: string | null; notes: string | null; created_at: string; };
type Payment = { id: string; amount: number; status: string; payment_method: string | null; description: string | null; created_at: string; paid_at: string | null; };

const mxn = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function AccountStatementClient({ account, charges, allCharges, payments, paymentResult, sessionId, internalPaymentId, providerPaymentId, cardPaymentsEnabled }: {
  account: { id: string; display_name: string; email: string | null; external_reference: string | null };
  charges: Charge[]; allCharges: Charge[]; payments: Payment[];
  paymentResult: "success" | "cancelled" | null;
  sessionId: string | null;
  internalPaymentId: string | null;
  providerPaymentId: string | null;
  cardPaymentsEnabled: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(charges.map((charge) => charge.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = charges.reduce((sum, charge) => sum + charge.outstanding_amount, 0);
  const selectedTotal = useMemo(() => charges.filter((charge) => selected.has(charge.id)).reduce((sum, charge) => sum + charge.outstanding_amount, 0), [charges, selected]);

  useEffect(() => {
    if (paymentResult === "cancelled" && internalPaymentId) {
      void fetch(`/api/payments/status?internal_payment_id=${encodeURIComponent(internalPaymentId)}`, { method: "DELETE" })
        .finally(() => router.refresh());
      return;
    }
    if (paymentResult !== "success" || (!sessionId && !internalPaymentId)) return;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const params = new URLSearchParams();
      if (sessionId) params.set("session_id", sessionId);
      if (internalPaymentId) params.set("internal_payment_id", internalPaymentId);
      if (providerPaymentId) params.set("provider_payment_id", providerPaymentId);
      const response = await fetch(`/api/payments/status?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (payload.status === "paid") {
        router.replace("/mi-cuenta");
        router.refresh();
      } else if (attempts < 7) window.setTimeout(check, 1200);
    };
    void check();
  }, [internalPaymentId, paymentResult, providerPaymentId, router, sessionId]);

  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function checkout() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ charge_ids: Array.from(selected) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error || "No se pudo iniciar el pago");
      window.location.href = payload.url;
    } catch { setError("El pago con tarjeta no está disponible por el momento."); setBusy(false); }
  }

  return (
    <div className="bg-cream px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="eyebrow eyebrow-line mb-4 text-gold">Cuenta privada</div><h1 className="serif-display text-[42px] leading-none text-navy sm:text-[54px]">Mi estado de cuenta</h1><p className="mt-3 text-[13px] text-ink-soft">{account.display_name}{account.external_reference ? ` · Cuenta ${account.external_reference}` : ""}</p></div>
          <div className="border border-line bg-cream-light px-6 py-4 text-right"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Saldo pendiente</div><div className="serif-display text-[32px] text-navy">{mxn(total)}</div></div>
        </div>

        {paymentResult === "success" && <div className="border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">Pago recibido. Tu saldo se actualizará en cuanto el proveedor confirme la operación.</div>}
        {paymentResult === "cancelled" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">El pago fue cancelado y no se hizo ningún cargo.</div>}
        {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>}

        <section className="border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream-light px-4 py-4 sm:px-6"><div><h2 className="text-[15px] font-bold text-navy">Cargos pendientes</h2><p className="text-[11px] text-ink-muted">Selecciona los conceptos que deseas pagar.</p></div>{charges.length > 0 && <button type="button" onClick={() => setSelected(selected.size === charges.length ? new Set() : new Set(charges.map((charge) => charge.id)))} className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold-deep">{selected.size === charges.length ? "Quitar selección" : "Seleccionar todo"}</button>}</div>
          {charges.length === 0 ? <div className="p-10 text-center"><div className="serif-display text-[28px] text-navy">Tu saldo está al corriente</div><p className="mt-2 text-[13px] text-ink-soft">No tienes cargos pendientes.</p></div> : <div>{charges.map((charge) => <label key={charge.id} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line-soft px-4 py-4 last:border-b-0 hover:bg-cream-light sm:px-6"><input type="checkbox" checked={selected.has(charge.id)} onChange={() => toggle(charge.id)} className="mt-1 h-4 w-4 accent-[#BD9040]" /><span><strong className="block text-[13px] text-navy">{charge.concept}</strong><span className="text-[11px] text-ink-muted">{charge.period || "Sin periodo"}{charge.due_date ? ` · Vence ${new Date(`${charge.due_date}T12:00:00`).toLocaleDateString("es-MX")}` : ""}</span>{charge.notes && <span className="mt-1 block text-[11px] text-ink-soft">{charge.notes}</span>}</span><strong className="text-[14px] text-navy">{mxn(charge.outstanding_amount)}</strong></label>)}</div>}
          {charges.length > 0 && <div className="flex flex-col gap-4 bg-navy p-5 text-cream sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cream/60">Total seleccionado</div><div className="serif-display text-[28px]">{mxn(selectedTotal)}</div>{!cardPaymentsEnabled && <p className="mt-1 text-[11px] text-cream/70">El pago con tarjeta no está disponible por el momento.</p>}</div><button type="button" disabled={!cardPaymentsEnabled || busy || selectedTotal <= 0} onClick={checkout} className="bg-gold px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-navy-deep hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50">{!cardPaymentsEnabled ? "Pago no disponible" : busy ? "Preparando pago..." : "Pagar con tarjeta"}</button></div>}
        </section>

        <section>
          <h2 className="serif-display text-[34px] text-navy sm:text-[40px]">Historial de movimientos</h2>
          <p className="mt-1 text-[12px] text-ink-soft">Aquí puedes consultar todos los cargos de la cuenta, incluyendo los que ya fueron pagados.</p>

          <div className="mt-5 border border-line bg-white">
            <div className="border-b border-line bg-cream-light px-4 py-3 sm:px-5"><h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-navy">Todos los cargos</h3></div>
            {allCharges.length > 0 ? <div>{allCharges.map((charge) => {
              const paidAmount = Math.max(0, charge.original_amount - charge.outstanding_amount);
              return <article key={charge.id} className="border-b border-line-soft p-4 last:border-b-0 sm:grid sm:grid-cols-[120px_minmax(0,1fr)_150px_120px] sm:items-center sm:gap-4 sm:px-5">
                <div className="text-[11px] text-ink-muted">{new Date(charge.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div className="mt-1 min-w-0 sm:mt-0"><strong className="block text-[13px] text-navy">{charge.concept}</strong><div className="text-[11px] text-ink-muted">{charge.period || "Sin periodo"}{charge.notes ? ` · ${charge.notes}` : ""}</div></div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] sm:mt-0 sm:block sm:text-right"><div><span className="block text-[9px] uppercase tracking-[0.12em] text-ink-muted">Cargo</span><strong className="text-[13px] text-navy">{mxn(charge.original_amount)}</strong></div><div className="sm:mt-1"><span className="block text-[9px] uppercase tracking-[0.12em] text-ink-muted">Abonado</span><strong className="text-green-700">{mxn(paidAmount)}</strong></div></div>
                <div className="mt-3 sm:mt-0 sm:text-right"><ChargeStatus status={charge.status} outstanding={charge.outstanding_amount} /></div>
              </article>;
            })}</div> : <p className="p-8 text-center text-[12px] text-ink-muted">Todavía no hay cargos registrados en esta cuenta.</p>}
          </div>

          <div className="mt-5 border border-line bg-white">
            <div className="border-b border-line bg-cream-light px-4 py-3 sm:px-5"><h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-navy">Pagos recibidos</h3></div>
            {payments.length > 0 ? <div>{payments.map((payment) => <article key={payment.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line-soft p-4 last:border-b-0 sm:grid-cols-[120px_minmax(0,1fr)_160px_130px] sm:items-center sm:px-5">
              <div className="col-span-2 text-[11px] text-ink-muted sm:col-span-1">{new Date(payment.paid_at || payment.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</div>
              <div><strong className="block text-[13px] text-navy">{payment.description || "Pago de estado de cuenta"}</strong><span className="text-[11px] text-ink-muted">{payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "mercadopago" ? "Mercado Pago" : payment.payment_method === "stripe" ? "Tarjeta" : payment.payment_method || "Otro"}</span></div>
              <div className="self-end text-right sm:self-auto"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-green-700">Pago confirmado</div><a href={`/api/receipts/${payment.id}`} className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[0.1em] text-gold-deep underline">Descargar comprobante PDF</a></div>
              <strong className="col-span-2 text-right text-[15px] text-green-700 sm:col-span-1">− {mxn(payment.amount)}</strong>
            </article>)}</div> : <p className="p-8 text-center text-[12px] text-ink-muted">Todavía no hay pagos registrados.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChargeStatus({ status, outstanding }: { status: Charge["status"]; outstanding: number }) {
  if (status === "paid") return <span className="inline-flex bg-green-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-green-800">Pagado</span>;
  if (status === "waived") return <span className="inline-flex bg-gray-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gray-700">Condonado</span>;
  return <span className="inline-flex bg-amber-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-900">Pendiente · {mxn(outstanding)}</span>;
}
