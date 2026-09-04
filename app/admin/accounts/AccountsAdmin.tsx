"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BillingAccountRow, ProfileOption } from "./types";

const inputClass = "w-full border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-gold";
const buttonClass = "bg-navy px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cream hover:bg-navy-deep disabled:opacity-50";

function mxn(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export default function AccountsAdmin({ accounts, profiles }: {
  accounts: BillingAccountRow[]; profiles: ProfileOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [accountRows, setAccountRows] = useState(accounts);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [cashAccountId, setCashAccountId] = useState("");
  const [cashChargeIds, setCashChargeIds] = useState<string[]>([]);
  // The server refresh returns the authoritative balances after every mutation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setAccountRows(accounts), [accounts]);
  const totalBalance = accountRows.reduce((sum, account) => sum + account.open_balance, 0);
  const totalPaid = accountRows.reduce((sum, account) => sum + account.total_paid, 0);
  const unlinked = accountRows.filter((account) => !account.profile_id).length;
  const pendingAccounts = accountRows.filter((account) => account.open_balance > 0).length;
  const currentAccounts = accountRows.length - pendingAccounts;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = accountRows.filter((account) => {
      const matchesQuery = !needle || [account.display_name, account.email, account.phone, account.external_reference]
        .some((value) => value?.toLowerCase().includes(needle));
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "pending" && account.open_balance > 0)
        || (statusFilter === "current" && account.open_balance <= 0)
        || (statusFilter === "paid" && account.total_paid > 0)
        || (statusFilter === "linked" && Boolean(account.profile_id))
        || (statusFilter === "unlinked" && !account.profile_id);
      return matchesQuery && matchesStatus;
    });
    return [...matches].sort((a, b) => {
      if (sortBy === "name_desc") return b.display_name.localeCompare(a.display_name, "es", { sensitivity: "base" });
      if (sortBy === "balance_desc") return b.open_balance - a.open_balance || a.display_name.localeCompare(b.display_name, "es");
      if (sortBy === "balance_asc") return a.open_balance - b.open_balance || a.display_name.localeCompare(b.display_name, "es");
      if (sortBy === "paid_desc") return b.total_paid - a.total_paid || a.display_name.localeCompare(b.display_name, "es");
      if (sortBy === "charges_desc") return b.open_charges - a.open_charges || a.display_name.localeCompare(b.display_name, "es");
      return a.display_name.localeCompare(b.display_name, "es", { sensitivity: "base" });
    });
  }, [accountRows, query, sortBy, statusFilter]);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleAccounts = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow eyebrow-line mb-4 text-gold">Cobranza privada</div>
        <h1 className="serif-display text-[38px] leading-none text-navy sm:text-[48px]">Estados de cuenta</h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-soft">Consulta saldos e historiales, encuentra rápidamente una cuenta y registra cargos o pagos con trazabilidad.</p>
      </div>

      {(message || error) && <div className={`border px-4 py-3 text-[13px] ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{error || message}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Saldo pendiente" value={mxn(totalBalance)} />
        <Metric label="Total pagado" value={mxn(totalPaid)} />
        <Metric label="Cuentas activas" value={String(accountRows.length)} />
        <Metric label="Con saldo" value={String(pendingAccounts)} warn={pendingAccounts > 0} />
        <Metric label="Al corriente" value={String(currentAccounts)} />
        <Metric label="Sin vincular" value={String(unlinked)} warn={unlinked > 0} />
      </div>

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
        <div><h2 className="serif-display text-[30px] text-navy">Cuentas</h2><p className="text-[12px] text-ink-soft">Filtra, ordena y abre el historial completo de cada persona.</p></div>
        <div className="mt-4 border border-line bg-cream-light p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_240px]">
            <input className={inputClass} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar persona, teléfono o referencia" />
            <select className={inputClass} value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} aria-label="Ordenar cuentas">
              <option value="name_asc">Nombre: A a Z</option>
              <option value="name_desc">Nombre: Z a A</option>
              <option value="balance_desc">Mayor saldo pendiente</option>
              <option value="balance_asc">Menor saldo pendiente</option>
              <option value="paid_desc">Mayor total pagado</option>
              <option value="charges_desc">Más cargos pendientes</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterButton active={statusFilter === "all"} onClick={() => { setStatusFilter("all"); setPage(1); }}>Todas · {accountRows.length}</FilterButton>
            <FilterButton active={statusFilter === "pending"} onClick={() => { setStatusFilter("pending"); setPage(1); }}>Con saldo · {pendingAccounts}</FilterButton>
            <FilterButton active={statusFilter === "current"} onClick={() => { setStatusFilter("current"); setPage(1); }}>Al corriente · {currentAccounts}</FilterButton>
            <FilterButton active={statusFilter === "paid"} onClick={() => { setStatusFilter("paid"); setPage(1); }}>Con pagos · {accountRows.filter((account) => account.total_paid > 0).length}</FilterButton>
            <FilterButton active={statusFilter === "linked"} onClick={() => { setStatusFilter("linked"); setPage(1); }}>Vinculadas · {accountRows.length - unlinked}</FilterButton>
            <FilterButton active={statusFilter === "unlinked"} onClick={() => { setStatusFilter("unlinked"); setPage(1); }}>Sin vincular · {unlinked}</FilterButton>
          </div>
          <div className="mt-3 text-[11px] text-ink-muted">Mostrando <strong className="text-navy">{filtered.length}</strong> de {accountRows.length} cuentas</div>
        </div>
        <div className="mt-4 overflow-x-auto border border-line bg-white">
          <table className="min-w-[1040px] w-full text-left text-[12px]">
            <thead className="bg-navy text-cream"><tr><th className="p-3">Cuenta</th><th className="p-3">Contacto</th><th className="p-3 text-right">Saldo pendiente</th><th className="p-3 text-right">Pagado</th><th className="p-3">Vinculación</th><th className="p-3 text-center">Detalle</th></tr></thead>
            <tbody>{visibleAccounts.map((account) => {
              const expanded = expandedAccountId === account.id;
              return <AccountTableRows key={account.id} account={account} expanded={expanded} busy={busy} profiles={profiles} onToggle={() => setExpandedAccountId(expanded ? null : account.id)} onLink={linkProfile} onDelete={() => deleteAccount(account)} />;
            })}</tbody>
          </table>
          {filtered.length === 0 && <p className="p-6 text-center text-[13px] text-ink-muted">No hay cuentas que coincidan.</p>}
        </div>
        {filtered.length > pageSize && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-cream-light px-4 py-3">
          <div className="text-[11px] text-ink-muted">Página {safePage} de {pageCount} · cuentas {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}</div>
          <div className="flex gap-2">
            <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="border border-line bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-navy disabled:opacity-40">Anterior</button>
            <button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="border border-line bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-navy disabled:opacity-40">Siguiente</button>
          </div>
        </div>}
      </section>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) { return <div className={`border p-4 text-center ${warn ? "border-amber-300 bg-amber-50" : "border-line bg-cream-light"}`}><div className="serif-display text-[26px] text-navy">{value}</div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">{label}</div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${active ? "border-navy bg-navy text-cream" : "border-line bg-white text-ink-soft hover:border-gold hover:text-navy"}`}>{children}</button>; }
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
          <div className="overflow-x-auto border border-line bg-white"><table className="min-w-[560px] w-full"><thead className="bg-white text-[10px] uppercase tracking-[0.12em] text-ink-muted"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Método / aplicación</th><th className="p-3 text-right">Importe</th><th className="p-3 text-left">Estado</th></tr></thead><tbody>{account.payments.map((payment) => <tr key={payment.id} className="border-t border-line-soft"><td className="p-3">{new Date(payment.paid_at || payment.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td><td className="p-3"><strong className="text-navy">{payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "mercadopago" ? "Mercado Pago" : payment.payment_method === "stripe" ? "Tarjeta" : payment.payment_method || "Otro"}</strong><div className="text-[10px] text-ink-muted">{payment.applied_to || payment.description || "Pago de estado de cuenta"}</div>{payment.notes && <div className="mt-1 text-[10px] text-ink-soft">{payment.notes}</div>}</td><td className={`p-3 text-right font-semibold ${payment.status === "paid" ? "text-green-700" : "text-ink-soft"}`}>{mxn(payment.amount)}</td><td className="p-3"><StatusPill status={payment.status} /></td></tr>)}{account.payments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-ink-muted">Todavía no hay pagos registrados.</td></tr>}</tbody></table></div>
        </div>
      </div>
    </td></tr>}
  </>;
}

function StatusPill({ status }: { status: string }) {
  const paid = status === "paid";
  const open = status === "open" || status === "pending";
  const label = status === "paid" ? "Pagado" : status === "open" ? "Pendiente" : status === "pending" ? "Procesando" : status === "waived" ? "Condonado" : status === "refunded" ? "Reembolsado" : status === "charged_back" ? "Contracargo" : status;
  return <span className={`inline-flex px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${paid ? "bg-green-100 text-green-800" : open ? "bg-amber-100 text-amber-900" : status === "charged_back" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"}`}>{label}</span>;
}
