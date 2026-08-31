"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Heart, Loader2, ShieldCheck } from "lucide-react";

const presetAmounts = [500, 1500, 3600];
const mxn = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);

export default function DonationForm({ paymentResult, sessionId, enabled }: { paymentResult: "success" | "cancelled" | null; sessionId: string | null; enabled: boolean }) {
  const [amount, setAmount] = useState("500");
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (paymentResult !== "success" || !sessionId) return;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const response = await fetch(`/api/payments/status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (body.status === "paid") setConfirmed(true);
      else if (attempts < 6) window.setTimeout(check, 1200);
    };
    void check();
  }, [paymentResult, sessionId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/donations/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, amount, frequency }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) throw new Error(body.error || "No se pudo iniciar el donativo");
      window.location.href = body.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar el donativo"); setBusy(false);
    }
  }

  if (confirmed) return <div className="border border-green-200 bg-green-50 p-8 text-center"><CheckCircle2 className="mx-auto h-11 w-11 text-green-700" /><h2 className="mt-4 font-serif text-3xl font-bold text-navy">Gracias por tu donativo</h2><p className="mt-2 text-sm text-ink-soft">Stripe confirmó el pago y enviamos el recibo al correo indicado.</p></div>;

  return <form onSubmit={submit} className="border border-line bg-cream-light p-5 sm:p-8">
    <div className="flex items-center gap-3"><Heart className="h-7 w-7 text-gold-deep" /><div><h2 className="font-serif text-3xl font-bold text-navy">Realizar un donativo</h2><p className="text-sm text-ink-soft">Pago seguro procesado por Stripe.</p></div></div>
    {paymentResult === "success" && !confirmed ? <div className="mt-5 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Pago recibido. Estamos confirmándolo…</div> : null}
    {paymentResult === "cancelled" ? <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">El donativo fue cancelado y no se realizó ningún cargo.</div> : null}
    {error ? <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
    <div className="mt-6 grid gap-6">
      <fieldset><legend className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">Frecuencia</legend><div className="mt-2 grid grid-cols-2 gap-2">{([['one_time','Una sola vez'],['monthly','Cada mes']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setFrequency(value)} className={`border px-4 py-3 text-sm font-semibold ${frequency === value ? "border-gold bg-gold/15 text-navy" : "border-line bg-white text-ink-soft"}`}>{label}</button>)}</div></fieldset>
      <fieldset><legend className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">Importe</legend><div className="mt-2 grid grid-cols-3 gap-2">{presetAmounts.map((value) => <button key={value} type="button" onClick={() => setAmount(String(value))} className={`border px-2 py-3 text-sm font-bold ${amount === String(value) ? "border-gold bg-gold text-navy-deep" : "border-line bg-white text-navy"}`}>{mxn(value)}</button>)}</div><label className="mt-3 block text-xs text-ink-muted">Otro importe (MXN)<input value={amount} onChange={(event) => setAmount(event.target.value)} required min="20" max="1000000" step="1" type="number" className="input mt-1.5 bg-white" /></label></fieldset>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-ink-muted">Nombre<input name="name" required maxLength={120} className="input mt-1.5 bg-white" autoComplete="name" /></label><label className="text-xs text-ink-muted">Correo para recibo<input name="email" required type="email" className="input mt-1.5 bg-white" autoComplete="email" /></label></div>
      <label className="text-xs text-ink-muted">Destino del donativo<select name="purpose" className="input mt-1.5 bg-white" defaultValue="general"><option value="general">Apoyo general al Midrash</option><option value="becas">Becas de estudio</option><option value="libros">Libros y material de estudio</option><option value="mantenimiento">Mantenimiento del Midrash</option><option value="eventos">Eventos comunitarios</option></select></label>
      <button disabled={!enabled || busy || Number(amount) < 20} className="btn-primary min-h-12 w-full justify-center">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Abriendo Stripe…</> : frequency === "monthly" ? `Donar ${mxn(Number(amount) || 0)} cada mes` : `Donar ${mxn(Number(amount) || 0)}`}</button>
      {!enabled ? <p className="text-center text-sm text-ink-muted">Los donativos en línea no están disponibles por el momento.</p> : null}
      <p className="flex items-center justify-center gap-2 text-center text-[11px] text-ink-muted"><ShieldCheck className="h-4 w-4" /> Natán Torá no almacena los datos de tu tarjeta.</p>
    </div>
  </form>;
}
