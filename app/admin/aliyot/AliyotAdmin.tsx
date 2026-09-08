"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, CalendarDays, Gift, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { ALIYAH_READING_TYPES, PARASHOT, type AliyahReadingType } from "@/lib/aliyot-constants";
import { formatMXN } from "@/lib/utils";

export type AliyahRecord = {
  id: string;
  person_name: string;
  occurred_on: string;
  reading_type: AliyahReadingType;
  parasha: string;
  had_donation: boolean;
  donation_amount: string | null;
  notes: string | null;
  created_at: Date;
  created_by_name: string | null;
};

type FormState = {
  person_name: string;
  occurred_on: string;
  reading_type: AliyahReadingType;
  parasha: string;
  had_donation: boolean;
  donation_amount: string;
  notes: string;
};

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyForm(): FormState {
  return { person_name: "", occurred_on: today(), reading_type: "Shabat", parasha: "", had_donation: false, donation_amount: "", notes: "" };
}

export default function AliyotAdmin({ initial }: { initial: AliyahRecord[] }) {
  const router = useRouter();
  const items = initial;
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AliyahReadingType>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("es-MX");
    return items.filter((item) => {
      if (typeFilter !== "all" && item.reading_type !== typeFilter) return false;
      if (!search) return true;
      return [item.person_name, item.parasha, item.reading_type, item.notes ?? ""].some((value) => value.toLocaleLowerCase("es-MX").includes(search));
    });
  }, [items, query, typeFilter]);

  const donationTotal = items.reduce((sum, item) => sum + Number(item.donation_amount ?? 0), 0);
  const donationCount = items.filter((item) => item.had_donation).length;

  function create() {
    setEditing(null);
    setForm(emptyForm());
    setMessage("");
    setOpen(true);
  }

  function edit(item: AliyahRecord) {
    setEditing(item.id);
    setForm({
      person_name: item.person_name,
      occurred_on: item.occurred_on,
      reading_type: item.reading_type,
      parasha: item.parasha,
      had_donation: item.had_donation,
      donation_amount: item.donation_amount ?? "",
      notes: item.notes ?? "",
    });
    setMessage("");
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setEditing(null);
    setForm(emptyForm());
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/aliyot", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editing }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo guardar");
      setOpen(false);
      setEditing(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: AliyahRecord) {
    if (!confirm(`¿Eliminar la aliyá de ${item.person_name}?\n\nEsta acción no se puede deshacer.`)) return;
    setMessage("");
    const response = await fetch("/api/admin/aliyot", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.error || "No se pudo eliminar");
    router.refresh();
  }

  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow eyebrow-line mb-4 text-gold">Sefer Torá</div>
        <h1 className="serif-display text-navy">Registro de <em>aliyot</em></h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">Registra quién subió al Sefer, la lectura correspondiente y si realizó un donativo.</p>
      </div>
      <button type="button" onClick={create} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Registrar aliyá</button>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Stat icon={BookOpenText} label="Aliyot registradas" value={String(items.length)} />
      <Stat icon={Gift} label="Con donativo" value={String(donationCount)} />
      <Stat icon={Gift} label="Total registrado" value={formatMXN(donationTotal)} />
    </div>

    {message && !open ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div> : null}

    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="input pl-10 normal-case" placeholder="Buscar por nombre, parashá o nota" />
      </label>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="input normal-case sm:w-52" aria-label="Filtrar por tipo de lectura">
        <option value="all">Todas las lecturas</option>
        {ALIYAH_READING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
    </div>

    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] divide-y divide-line text-sm">
          <thead className="bg-navy text-cream"><tr>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Fecha</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Nombre</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Lectura</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Parashá</th>
            <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Donativo</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Notas</th>
            <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Acciones</th>
          </tr></thead>
          <tbody className="divide-y divide-line-soft">
            {!filtered.length ? <tr><td colSpan={7} className="px-5 py-12 text-center text-ink-muted">No hay aliyot que coincidan.</td></tr> : null}
            {filtered.map((item) => <tr key={item.id} className="align-top hover:bg-cream-light/70">
              <td className="whitespace-nowrap px-4 py-4 font-medium text-ink"><CalendarDays className="mr-1.5 inline h-3.5 w-3.5 text-gold-deep" />{formatDate(item.occurred_on)}</td>
              <td className="px-4 py-4"><div className="font-semibold text-navy">{item.person_name}</div>{item.created_by_name ? <div className="mt-1 text-[10px] text-ink-muted">Registró: {item.created_by_name}</div> : null}</td>
              <td className="px-4 py-4"><span className="inline-flex rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-gold-deep">{item.reading_type}</span></td>
              <td className="px-4 py-4 font-medium text-ink">{item.parasha}</td>
              <td className="px-4 py-4 text-right font-semibold text-navy">{item.had_donation ? formatMXN(Number(item.donation_amount ?? 0)) : <span className="font-normal text-ink-muted">Sin donativo</span>}</td>
              <td className="max-w-[220px] px-4 py-4 text-ink-soft">{item.notes || "—"}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => edit(item)} className="rounded p-2 text-navy hover:bg-cream" aria-label={`Editar aliyá de ${item.person_name}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => remove(item)} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label={`Eliminar aliyá de ${item.person_name}`}><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>

    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold text-navy">{editing ? "Editar aliyá" : "Nueva aliyá"}</h2><p className="mt-1 text-sm text-ink-soft">Completa los datos de la persona que subió al Sefer.</p></div><button type="button" onClick={close} className="rounded-lg p-2 hover:bg-cream" aria-label="Cerrar"><X className="h-5 w-5" /></button></div>
        <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" full><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" /><input required autoFocus maxLength={120} className="input pl-10 normal-case" value={form.person_name} onChange={(event) => setForm({ ...form, person_name: event.target.value })} placeholder="Nombre de la persona" /></div></Field>
          <Field label="Fecha"><input required type="date" className="input normal-case" value={form.occurred_on} onChange={(event) => setForm({ ...form, occurred_on: event.target.value })} /></Field>
          <Field label="Tipo de lectura"><select required className="input normal-case" value={form.reading_type} onChange={(event) => setForm({ ...form, reading_type: event.target.value as AliyahReadingType })}>{ALIYAH_READING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
          <Field label="Parashá" full><select required className="input normal-case" value={form.parasha} onChange={(event) => setForm({ ...form, parasha: event.target.value })}><option value="">Selecciona una parashá</option>{PARASHOT.map((parasha) => <option key={parasha} value={parasha}>{parasha}</option>)}</select></Field>
          <Field label="Donativo" full><label className="flex min-h-12 items-center gap-3 rounded border border-line bg-cream-light px-4"><input type="checkbox" checked={form.had_donation} onChange={(event) => setForm({ ...form, had_donation: event.target.checked, donation_amount: event.target.checked ? form.donation_amount : "" })} /><span className="text-sm font-medium normal-case text-ink">Sí hubo donativo</span></label></Field>
          {form.had_donation ? <Field label="Importe del donativo"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-ink-muted">$</span><input required type="number" min="0.01" max="10000000" step="0.01" inputMode="decimal" className="input pl-7 normal-case" value={form.donation_amount} onChange={(event) => setForm({ ...form, donation_amount: event.target.value })} placeholder="0.00" /></div></Field> : null}
          <Field label="Notas" full><textarea maxLength={500} rows={3} className="input normal-case" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Información adicional (opcional)" /></Field>
          {message ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm normal-case text-red-800 sm:col-span-2">{message}</div> : null}
          <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" disabled={busy} onClick={close} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Cancelar</button><button type="submit" disabled={busy} className="btn-primary">{busy ? "Guardando…" : editing ? "Guardar cambios" : "Registrar aliyá"}</button></div>
        </form>
      </div>
    </div> : null}
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-white p-4"><Icon className="h-5 w-5 text-gold-deep" /><div className="mt-3 font-serif text-2xl font-bold text-navy">{value}</div><div className="text-xs text-ink-muted">{label}</div></div>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`text-xs font-semibold uppercase tracking-wide text-ink-muted ${full ? "sm:col-span-2" : ""}`}>{label}<span className="mt-1.5 block">{children}</span></label>;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
