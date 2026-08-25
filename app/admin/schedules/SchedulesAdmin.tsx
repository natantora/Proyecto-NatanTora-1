"use client";

import { useState } from "react";
import { Clock3, Pencil, Plus, Trash2, X } from "lucide-react";

export type ScheduleRow = {
  id: string;
  name: string;
  description: string | null;
  days: string;
  time: string | null;
  time_mode: "fixed" | "before_sunset" | "after_sunset";
  offset_minutes: number;
  active: boolean;
  position: number;
};

const EMPTY = { name: "", description: "", days: "Lunes a Viernes", time: "07:00", time_mode: "fixed" as ScheduleRow["time_mode"], offset_minutes: 15, active: true, position: 0 };

export default function SchedulesAdmin({ initial }: { initial: ScheduleRow[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function create() { setEditing(null); setForm(EMPTY); setOpen(true); setMessage(""); }
  function edit(item: ScheduleRow) {
    setEditing(item.id);
    setForm({ name: item.name, description: item.description ?? "", days: item.days, time: item.time ?? "07:00", time_mode: item.time_mode, offset_minutes: Math.abs(item.offset_minutes), active: item.active, position: item.position });
    setOpen(true); setMessage("");
  }
  function close() { setOpen(false); setEditing(null); setForm(EMPTY); }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/schedules", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems((current) => (editing ? current.map((item) => item.id === editing ? body.schedule : item) : [...current, body.schedule]).sort((a, b) => a.position - b.position));
      close();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar"); }
    finally { setLoading(false); }
  }

  async function remove(item: ScheduleRow) {
    if (!confirm(`¿Eliminar el horario “${item.name}”?`)) return;
    const response = await fetch("/api/schedules", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    if (response.ok) setItems((current) => current.filter((row) => row.id !== item.id));
    else setMessage((await response.json().catch(() => ({}))).error ?? "No fue posible eliminar");
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-soft">{items.length} horarios · {items.filter((item) => item.active).length} visibles</p><button onClick={create} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Agregar horario</button></div>
    {message ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div> : null}
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4"><div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-7">
      <div className="flex justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold text-navy">{editing ? "Editar horario" : "Nuevo horario"}</h2><p className="mt-1 text-sm text-ink-soft">Puede tener una hora fija o calcularse respecto al shkiá.</p></div><button type="button" aria-label="Cerrar formulario" onClick={close} className="rounded-lg p-2 hover:bg-cream"><X className="h-5 w-5" /></button></div>
      <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre"><input required className="input normal-case" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Shajarit" /></Field>
        <Field label="Días"><input required className="input normal-case" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} placeholder="Ej. Lunes a Viernes" /></Field>
        <Field label="Tipo de horario"><select className="input normal-case" value={form.time_mode} onChange={(e) => setForm({ ...form, time_mode: e.target.value as ScheduleRow["time_mode"] })}><option value="fixed">Hora fija</option><option value="before_sunset">Antes del shkiá</option><option value="after_sunset">Después del shkiá</option></select></Field>
        {form.time_mode === "fixed" ? <Field label="Hora"><input required type="time" className="input normal-case" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field> : <Field label="Minutos de ajuste"><input required type="number" min={0} max={240} className="input normal-case" value={form.offset_minutes} onChange={(e) => setForm({ ...form, offset_minutes: Number(e.target.value) })} /><span className="mt-1 block text-xs normal-case text-ink-muted">Escribe 15 para calcularlo 15 minutos {form.time_mode === "before_sunset" ? "antes" : "después"}.</span></Field>}
        <Field label="Orden"><input type="number" min={0} max={1000} className="input normal-case" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} /></Field>
        <Field label="Visibilidad"><label className="flex min-h-11 items-center gap-3 rounded border border-line bg-cream-light px-3"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span className="text-sm normal-case text-ink-soft">Visible para los miembros</span></label></Field>
        <Field label="Descripción" full><textarea className="input normal-case" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Nota opcional" /></Field>
        <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={close} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Cancelar</button><button disabled={loading} className="btn-primary" type="submit">{loading ? "Guardando…" : "Guardar horario"}</button></div>
      </form>
    </div></div> : null}
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => <article key={item.id} className={`rounded-xl border bg-white p-5 ${item.active ? "border-line" : "border-line opacity-60"}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-xl font-bold text-navy">{item.name}</h3>{!item.active ? <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">Oculto</span> : null}</div><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gold-deep">{item.days}</p></div><Clock3 className="h-5 w-5 shrink-0 text-gold" /></div><div className="mt-4 text-2xl font-bold tabular-nums text-navy">{label(item)}</div>{item.description ? <p className="mt-2 text-sm text-ink-soft">{item.description}</p> : null}<div className="mt-5 flex gap-2 border-t border-line pt-3"><button onClick={() => edit(item)} className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold text-navy hover:bg-cream"><Pencil className="h-3.5 w-3.5" /> Editar</button><button onClick={() => remove(item)} className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Eliminar</button></div></article>)}
    </div>
  </div>;
}

function label(item: ScheduleRow) {
  if (item.time_mode === "fixed") return item.time ?? "—";
  const amount = Math.abs(item.offset_minutes);
  const relation = item.time_mode === "before_sunset" ? "antes" : "después";
  return `${amount} min ${relation} del shkiá`;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`text-xs font-semibold uppercase tracking-wide text-ink-muted ${full ? "sm:col-span-2" : ""}`}>{label}<span className="mt-1.5 block">{children}</span></label>;
}
