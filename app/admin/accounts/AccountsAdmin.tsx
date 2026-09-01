"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BillingAccountRow, ImportSummary, ProfileOption } from "./types";

type PreviewRow = {
  row_number: number; reference: string; account_reference: string; name: string;
  email: string; phone: string; concept: string; period: string; amount: number;
  due_date: string | null; notes: string; account_id: string; match_label: string | null;
};

const inputClass = "w-full border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-gold";
const buttonClass = "bg-navy px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cream hover:bg-navy-deep disabled:opacity-50";

function mxn(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export default function AccountsAdmin({ accounts, profiles, imports }: {
  accounts: BillingAccountRow[]; profiles: ProfileOption[]; imports: ImportSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ filename: string; rows: PreviewRow[]; errors: string[] } | null>(null);
  const [query, setQuery] = useState("");
  const [accountRows, setAccountRows] = useState(accounts);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [cashAccountId, setCashAccountId] = useState("");
  const [cashChargeIds, setCashChargeIds] = useState<string[]>([]);
  // The server refresh returns the authoritative balances after every mutation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAccountRows(accounts), [accounts]);
  const totalBalance = accountRows.reduce((sum, account) => sum + account.open_balance, 0);
  const unlinked = accountRows.filter((account) => !account.profile_id).length;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accountRows;
    return accountRows.filter((account) => [account.display_name, account.email, account.phone, account.external_reference]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [accountRows, query]);

  async function api(url: string, options: RequestInit) {
    setError(null); setMessage(null); setBusy(true);
    try {
      const response = await fetch(url, options);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo completar la operación");
      return payload;
    } finally { setBusy(false); }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/api/admin/billing/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setMessage("Cuenta creada correctamente"); form.reset(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function createCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/api/admin/billing/charges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setMessage("Cargo agregado al estado de cuenta"); form.reset(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function recordCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = { account_id: cashAccountId, charge_ids: cashChargeIds, notes: String(new FormData(form).get("notes") || "") };
    try {
      const result = await api("/api/admin/billing/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setAccountRows((current) => current.map((account) => account.id === result.payment.account_id
        ? { ...account, open_balance: result.payment.open_balance, open_charges: result.payment.open_charges, total_paid: account.total_paid + result.payment.amount }
        : account));
      setMessage("Pago en efectivo registrado en los cargos seleccionados");
      setCashAccountId(""); setCashChargeIds([]); form.reset(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function linkProfile(accountId: string, profileId: string) {
    try {
      await api("/api/admin/billing/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: accountId, profile_id: profileId }) });
      setMessage(profileId ? "Cuenta vinculada" : "Vinculación eliminada"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function deleteAccount(account: BillingAccountRow) {
    if (!window.confirm(`¿Eliminar definitivamente la cuenta de ${account.display_name}?\n\nSolo se eliminará si no tiene historial de pagos.`)) return;
    try {
      await api("/api/admin/billing/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: account.id }) });
      setAccountRows((current) => current.filter((item) => item.id !== account.id));
      setMessage("Cuenta eliminada correctamente");
      if (expandedAccountId === account.id) setExpandedAccountId(null);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function previewExcel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const result = await api("/api/admin/billing/import/preview", { method: "POST", body: new FormData(form) });
      setPreview(result); setMessage(`Excel leído: ${result.rows.length} filas válidas`);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function confirmImport() {
    if (!preview) return;
    try {
      const result = await api("/api/admin/billing/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preview) });
      setMessage(`Importación terminada: ${result.summary.imported} cargos, ${result.summary.duplicates} duplicados, ${result.summary.errors} errores`);
      setPreview(null); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow eyebrow-line mb-4 text-gold">Cobranza privada</div>
        <h1 className="serif-display text-[38px] leading-none text-navy sm:text-[48px]">Estados de cuenta</h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-soft">Importa saldos desde Excel, crea personas manualmente, vincula sus cuentas y registra pagos con trazabilidad.</p>
      </div>

      {(message || error) && <div className={`border px-4 py-3 text-[13px] ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{error || message}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Saldo pendiente" value={mxn(totalBalance)} />
        <Metric label="Cuentas activas" value={String(accountRows.length)} />
        <Metric label="Sin vincular" value={String(unlinked)} warn={unlinked > 0} />
      </div>

      <section className="border border-line bg-cream-light p-5 sm:p-7">
        <h2 className="serif-display text-[28px] text-navy">Importar Excel</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">Columnas mínimas: <strong>Nombre, Concepto e Importe</strong>. También acepta Referencia, Correo, Teléfono, Periodo, Fecha límite y Notas.</p>
        <form onSubmit={previewExcel} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-soft">Archivo .xlsx
            <input name="file" type="file" accept=".xlsx,.xlsm" required className="mt-2 block w-full border border-line bg-white px-3 py-2 text-[12px]" />
          </label>
          <button disabled={busy} className={buttonClass}>Revisar archivo</button>
        </form>
        {preview && (
          <div className="mt-6 space-y-4">
            {preview.errors.length > 0 && <div className="border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">{preview.errors.slice(0, 8).map((item) => <div key={item}>{item}</div>)}</div>}
            <div className="max-h-[420px] overflow-auto border border-line bg-white">
              <table className="min-w-[900px] w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-navy text-cream"><tr><th className="p-3">Fila</th><th className="p-3">Persona</th><th className="p-3">Concepto</th><th className="p-3 text-right">Importe</th><th className="p-3">Asociar a</th></tr></thead>
                <tbody>{preview.rows.map((row, index) => <tr key={`${row.reference}-${row.row_number}`} className="border-t border-line-soft">
                  <td className="p-3">{row.row_number}</td><td className="p-3"><strong>{row.name}</strong><div className="text-ink-muted">{row.email || "Sin correo"}</div></td><td className="p-3">{row.concept}<div className="text-ink-muted">{row.period}</div></td><td className="p-3 text-right font-semibold">{mxn(row.amount)}</td><td className="p-3"><select className={inputClass} value={row.account_id} onChange={(event) => setPreview((current) => current ? { ...current, rows: current.rows.map((item, rowIndex) => rowIndex === index ? { ...item, account_id: event.target.value } : item) } : current)}><option value="">Crear cuenta nueva</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}{account.email ? ` · ${account.email}` : ""}</option>)}</select></td>
                </tr>)}</tbody>
              </table>
            </div>
            <button type="button" disabled={busy || preview.rows.length === 0} onClick={confirmImport} className={buttonClass}>Confirmar importación</button>
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <ActionForm title="Crear persona o cuenta" onSubmit={createAccount}>
          <input className={inputClass} name="display_name" placeholder="Nombre completo" required />
          <input className={inputClass} name="email" type="email" placeholder="Correo (opcional)" />
          <input className={inputClass} name="phone" placeholder="Teléfono (opcional)" />
          <input className={inputClass} name="external_reference" placeholder="Número de cuenta o referencia" />
          <select className={inputClass} name="profile_id" defaultValue=""><option value="">Sin usuario vinculado</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} · {profile.email}</option>)}</select>
          <button disabled={busy} className={buttonClass}>Crear cuenta</button>
        </ActionForm>
        <ActionForm title="Agregar cargo manual" onSubmit={createCharge}>
          <AccountSelect accounts={accounts} />
          <input className={inputClass} name="concept" placeholder="Concepto" required />
          <div className="grid grid-cols-2 gap-2"><input className={inputClass} name="period" placeholder="Periodo" /><input className={inputClass} name="amount" type="number" min="0.01" step="0.01" placeholder="Importe" required /></div>
          <input className={inputClass} name="due_date" type="date" />
          <textarea className={inputClass} name="notes" placeholder="Notas" rows={2} />
          <button disabled={busy || accounts.length === 0} className={buttonClass}>Agregar cargo</button>
        </ActionForm>
        <ActionForm title="Registrar pago en efectivo" onSubmit={recordCash}>
          <select className={inputClass} name="account_id" required value={cashAccountId} onChange={(event) => { setCashAccountId(event.target.value); setCashChargeIds([]); }}>
            <option value="" disabled>Selecciona una cuenta</option>
            {accountRows.filter((account) => account.open_balance > 0).map((account) => <option key={account.id} value={account.id}>{account.display_name} · {mxn(account.open_balance)}</option>)}
          </select>
          {cashAccountId && <CashChargeSelector account={accountRows.find((account) => account.id === cashAccountId) || null} selected={cashChargeIds} onChange={setCashChargeIds} />}
          <textarea className={inputClass} name="notes" placeholder="Recibo, fecha o comentarios" rows={3} />
          <p className="text-[11px] leading-relaxed text-ink-muted">El importe se calcula con los cargos marcados y se liquidan exactamente esos conceptos.</p>
          <button disabled={busy || cashChargeIds.length === 0} className={buttonClass}>Registrar efectivo</button>
        </ActionForm>
      </div>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="serif-display text-[30px] text-navy">Cuentas</h2><p className="text-[12px] text-ink-soft">Vincula cada cuenta con el usuario que podrá verla y pagarla.</p></div><input className={`${inputClass} sm:max-w-xs`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar persona, correo o referencia" /></div>
        <div className="mt-4 overflow-x-auto border border-line bg-white">
          <table className="min-w-[1040px] w-full text-left text-[12px]">
            <thead className="bg-navy text-cream"><tr><th className="p-3">Cuenta</th><th className="p-3">Contacto</th><th className="p-3 text-right">Saldo pendiente</th><th className="p-3 text-right">Pagado</th><th className="p-3">Vinculación</th><th className="p-3 text-center">Detalle</th></tr></thead>
            <tbody>{filtered.map((account) => {
              const expanded = expandedAccountId === account.id;
              return <AccountTableRows key={account.id} account={account} expanded={expanded} busy={busy} profiles={profiles} onToggle={() => setExpandedAccountId(expanded ? null : account.id)} onLink={linkProfile} onDelete={() => deleteAccount(account)} />;
            })}</tbody>
          </table>
          {filtered.length === 0 && <p className="p-6 text-center text-[13px] text-ink-muted">No hay cuentas que coincidan.</p>}
        </div>
      </section>

      {imports.length > 0 && <section><h2 className="serif-display text-[28px] text-navy">Últimas importaciones</h2><div className="mt-3 grid gap-2">{imports.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border border-line bg-cream-light px-4 py-3 text-[12px]"><span><strong>{item.filename}</strong> · {new Date(item.created_at).toLocaleString("es-MX")}</span><span>{item.imported_rows} nuevos · {item.duplicate_rows} duplicados · {item.error_rows} errores</span></div>)}</div></section>}
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) { return <div className={`border p-4 text-center ${warn ? "border-amber-300 bg-amber-50" : "border-line bg-cream-light"}`}><div className="serif-display text-[26px] text-navy">{value}</div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">{label}</div></div>; }
function ActionForm({ title, onSubmit, children }: { title: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: React.ReactNode }) { return <form onSubmit={onSubmit} className="space-y-3 border border-line bg-cream-light p-5"><h2 className="serif-display text-[24px] text-navy">{title}</h2>{children}</form>; }
function AccountSelect({ accounts }: { accounts: BillingAccountRow[] }) { return <select className={inputClass} name="account_id" required defaultValue=""><option value="" disabled>Selecciona una cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {mxn(account.open_balance)}</option>)}</select>; }

function CashChargeSelector({ account, selected, onChange }: { account: BillingAccountRow | null; selected: string[]; onChange: (ids: string[]) => void }) {
  const charges = account?.charges.filter((charge) => charge.status === "open" && charge.outstanding_amount > 0) || [];
  const total = charges.filter((charge) => selected.includes(charge.id)).reduce((sum, charge) => sum + charge.outstanding_amount, 0);
  return <div className="border border-line bg-white">
    <div className="flex items-center justify-between border-b border-line px-3 py-2"><strong className="text-[11px] uppercase tracking-[0.12em] text-navy">Cargos a pagar</strong><span className="font-semibold text-navy">{mxn(total)}</span></div>
    <div className="max-h-48 overflow-y-auto">{charges.map((charge) => <label key={charge.id} className="flex cursor-pointer items-start gap-3 border-b border-line-soft px-3 py-2.5 last:border-0">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-gold" checked={selected.includes(charge.id)} onChange={(event) => onChange(event.target.checked ? [...selected, charge.id] : selected.filter((id) => id !== charge.id))} />
      <span className="min-w-0 flex-1 text-[12px]"><strong className="block truncate text-navy">{charge.concept}</strong><span className="text-ink-muted">{charge.period || "Sin periodo"}</span></span>
      <strong className="text-[12px] text-navy">{mxn(charge.outstanding_amount)}</strong>
    </label>)}{charges.length === 0 && <p className="p-3 text-[11px] text-ink-muted">Esta cuenta no tiene cargos pendientes.</p>}</div>
  </div>;
}

function AccountTableRows({ account, expanded, busy, profiles, onToggle, onLink, onDelete }: {
  account: BillingAccountRow;
  expanded: boolean;
  busy: boolean;
  profiles: ProfileOption[];
  onToggle: () => void;
  onLink: (accountId: string, profileId: string) => void;
  onDelete: () => void;
}) {
  return <>
    <tr className="border-t border-line-soft align-top hover:bg-cream-light/60">
      <td className="p-3"><strong className="text-navy">{account.display_name}</strong><div className="mt-0.5 text-ink-muted">{account.external_reference || "Sin referencia"} · {account.open_charges} cargos abiertos</div></td>
      <td className="p-3">{account.email || "Sin correo"}<div className="text-ink-muted">{account.phone || "Sin teléfono"}</div></td>
      <td className="p-3 text-right"><strong className={account.open_balance > 0 ? "text-navy" : "text-green-700"}>{mxn(account.open_balance)}</strong><div className="text-[10px] text-ink-muted">{account.open_balance > 0 ? "Por cobrar" : "Al corriente"}</div></td>
      <td className="p-3 text-right font-semibold text-green-700">{mxn(account.total_paid)}</td>
      <td className="p-3"><select className={inputClass} value={account.profile_id || ""} onChange={(event) => onLink(account.id, event.target.value)} disabled={busy}><option value="">Sin usuario vinculado</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} · {profile.email}</option>)}</select></td>
      <td className="p-3 text-center"><div className="flex justify-center gap-2"><button type="button" onClick={onToggle} className="border border-gold px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-navy hover:bg-gold hover:text-navy-deep">{expanded ? "Cerrar" : "Ver movimientos"}</button><button type="button" onClick={onDelete} disabled={busy} className="border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button></div></td>
    </tr>
    {expanded && <tr className="border-t border-line bg-cream-light"><td colSpan={6} className="p-4 sm:p-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="serif-display text-[23px] text-navy">Cargos</h3><span className="text-[11px] text-ink-muted">{account.charges.length} movimientos</span></div>
          <div className="overflow-x-auto border border-line bg-white"><table className="min-w-[620px] w-full"><thead className="bg-white text-[10px] uppercase tracking-[0.12em] text-ink-muted"><tr><th className="p-3 text-left">Fecha / concepto</th><th className="p-3 text-right">Cargo</th><th className="p-3 text-right">Abonado</th><th className="p-3 text-right">Pendiente</th><th className="p-3 text-left">Estado</th></tr></thead><tbody>{account.charges.map((charge) => {
            const paid = Math.max(0, charge.original_amount - charge.outstanding_amount);
            return <tr key={charge.id} className="border-t border-line-soft"><td className="p-3"><strong className="text-navy">{charge.concept}</strong><div className="text-[10px] text-ink-muted">{new Date(charge.created_at).toLocaleDateString("es-MX")}{charge.period ? ` · ${charge.period}` : ""}{charge.due_date ? ` · Vence ${new Date(`${charge.due_date}T12:00:00`).toLocaleDateString("es-MX")}` : ""}</div>{charge.notes && <div className="mt-1 text-[10px] text-ink-soft">{charge.notes}</div>}</td><td className="p-3 text-right">{mxn(charge.original_amount)}</td><td className="p-3 text-right text-green-700">{mxn(paid)}</td><td className="p-3 text-right font-semibold text-navy">{mxn(charge.outstanding_amount)}</td><td className="p-3"><StatusPill status={charge.status} /></td></tr>;
          })}{account.charges.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-muted">Esta cuenta todavía no tiene cargos.</td></tr>}</tbody></table></div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="serif-display text-[23px] text-navy">Pagos</h3><span className="text-[11px] text-ink-muted">{account.payments.length} movimientos</span></div>
          <div className="overflow-x-auto border border-line bg-white"><table className="min-w-[560px] w-full"><thead className="bg-white text-[10px] uppercase tracking-[0.12em] text-ink-muted"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Método / aplicación</th><th className="p-3 text-right">Importe</th><th className="p-3 text-left">Estado</th></tr></thead><tbody>{account.payments.map((payment) => <tr key={payment.id} className="border-t border-line-soft"><td className="p-3">{new Date(payment.paid_at || payment.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td><td className="p-3"><strong className="text-navy">{payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "mercadopago" ? "Mercado Pago" : payment.payment_method === "stripe" ? "Tarjeta" : payment.payment_method || "Otro"}</strong><div className="text-[10px] text-ink-muted">{payment.applied_to || payment.description || "Pago de estado de cuenta"}</div>{payment.notes && <div className="mt-1 text-[10px] text-ink-soft">{payment.notes}</div>}</td><td className="p-3 text-right font-semibold text-green-700">{mxn(payment.amount)}</td><td className="p-3"><StatusPill status={payment.status} /></td></tr>)}{account.payments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-ink-muted">Todavía no hay pagos registrados.</td></tr>}</tbody></table></div>
        </div>
      </div>
    </td></tr>}
  </>;
}

function StatusPill({ status }: { status: string }) {
  const paid = status === "paid";
  const open = status === "open" || status === "pending";
  const label = status === "paid" ? "Pagado" : status === "open" ? "Pendiente" : status === "pending" ? "Procesando" : status === "waived" ? "Condonado" : status === "refunded" ? "Reembolsado" : status;
  return <span className={`inline-flex px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${paid ? "bg-green-100 text-green-800" : open ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}`}>{label}</span>;
}
