"use client";

import { useMemo, useState } from "react";

type Charge = { id: string; concept: string; period: string | null; original_amount: number; outstanding_amount: number; due_date: string | null; notes: string | null; created_at: string; };
type Payment = { id: string; amount: number; status: string; payment_method: string | null; description: string | null; created_at: string; paid_at: string | null; };

const mxn = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function AccountStatementClient({ account, charges, payments, paymentResult }: {
  account: { id: string; display_name: string; email: string | null; external_reference: string | null };
  charges: Charge[]; payments: Payment[];
  paymentResult: "success" | "cancelled" | null;
}) {
  const [selected, setSelected] = useState(() => new Set(charges.map((charge) => charge.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = charges.reduce((sum, charge) => sum + charge.outstanding_amount, 0);
  const selectedTotal = useMemo(() => charges.filter((charge) => selected.has(charge.id)).reduce((sum, charge) => sum + charge.outstanding_amount, 0), [charges, selected]);

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
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo iniciar el pago"); setBusy(false); }
  }

  return (
    <div className="bg-cream px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="eyebrow eyebrow-line mb-4 text-gold">Cuenta privada</div><h1 className="serif-display text-[42px] leading-none text-navy sm:text-[54px]">Mi estado de cuenta</h1><p className="mt-3 text-[13px] text-ink-soft">{account.display_name}{account.external_reference ? ` · Cuenta ${account.external_reference}` : ""}</p></div>
          <div className="border border-line bg-cream-light px-6 py-4 text-right"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Saldo pendiente</div><div className="serif-display text-[32px] text-navy">{mxn(total)}</div></div>
        </div>

        {paymentResult === "success" && <div className="border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">Pago recibido. Tu saldo se actualizará en cuanto Stripe confirme la operación.</div>}
        {paymentResult === "cancelled" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">El pago fue cancelado y no se hizo ningún cargo.</div>}
        {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>}

        <section className="border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream-light px-4 py-4 sm:px-6"><div><h2 className="text-[15px] font-bold text-navy">Cargos pendientes</h2><p className="text-[11px] text-ink-muted">Selecciona los conceptos que deseas pagar.</p></div>{charges.length > 0 && <button type="button" onClick={() => setSelected(selected.size === charges.length ? new Set() : new Set(charges.map((charge) => charge.id)))} className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold-deep">{selected.size === charges.length ? "Quitar selección" : "Seleccionar todo"}</button>}</div>
          {charges.length === 0 ? <div className="p-10 text-center"><div className="serif-display text-[28px] text-navy">Tu saldo está al corriente</div><p className="mt-2 text-[13px] text-ink-soft">No tienes cargos pendientes.</p></div> : <div>{charges.map((charge) => <label key={charge.id} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line-soft px-4 py-4 last:border-b-0 hover:bg-cream-light sm:px-6"><input type="checkbox" checked={selected.has(charge.id)} onChange={() => toggle(charge.id)} className="mt-1 h-4 w-4 accent-[#BD9040]" /><span><strong className="block text-[13px] text-navy">{charge.concept}</strong><span className="text-[11px] text-ink-muted">{charge.period || "Sin periodo"}{charge.due_date ? ` · Vence ${new Date(`${charge.due_date}T12:00:00`).toLocaleDateString("es-MX")}` : ""}</span>{charge.notes && <span className="mt-1 block text-[11px] text-ink-soft">{charge.notes}</span>}</span><strong className="text-[14px] text-navy">{mxn(charge.outstanding_amount)}</strong></label>)}</div>}
          {charges.length > 0 && <div className="flex flex-col gap-4 bg-navy p-5 text-cream sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cream/60">Total seleccionado</div><div className="serif-display text-[28px]">{mxn(selectedTotal)}</div></div><button type="button" disabled={busy || selectedTotal <= 0} onClick={checkout} className="bg-gold px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-navy-deep hover:bg-gold-light disabled:opacity-50">{busy ? "Preparando pago..." : "Pagar con tarjeta"}</button></div>}
        </section>

        <section><h2 className="serif-display text-[30px] text-navy">Historial de pagos</h2><div className="mt-3 overflow-x-auto border border-line bg-white"><table className="min-w-[600px] w-full text-left text-[12px]"><thead className="bg-cream-light"><tr><th className="p-3">Fecha</th><th className="p-3">Descripción</th><th className="p-3">Método</th><th className="p-3 text-right">Importe</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-t border-line-soft"><td className="p-3">{new Date(payment.paid_at || payment.created_at).toLocaleDateString("es-MX")}</td><td className="p-3">{payment.description || "Pago de estado de cuenta"}</td><td className="p-3">{payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "stripe" ? "Tarjeta" : payment.payment_method || "—"}</td><td className="p-3 text-right font-semibold">{mxn(payment.amount)}</td></tr>)}{payments.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-ink-muted">Todavía no hay pagos registrados.</td></tr>}</tbody></table></div></section>
      </div>
    </div>
  );
}
