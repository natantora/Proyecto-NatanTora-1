"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, X } from "lucide-react";

type EventRow = { id: string; title: string; description: string | null; event_date: string; location: string | null; };

export default function EventsAdmin({ initial }: { initial: EventRow[] }) {
  const [list, setList] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", event_date: "", location: "Midrash Natán Torá" });
  const [submitting, setSubmitting] = useState(false);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, event_date: new Date(form.event_date).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setList((p) => [body.event, ...p]);
      setForm({ title: "", description: "", event_date: "", location: "Midrash Natán Torá" });
      setShowForm(false);
    } catch { alert("Error creando evento"); }
    finally { setSubmitting(false); }
  }

  async function deleteEvent(id: string) {
    if (!confirm("¿Eliminar evento?")) return;
    setLoadingId(id);
    try {
      const res = await fetch("/api/events", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error();
      setList((p) => p.filter((x) => x.id !== id));
    } catch { alert("Error"); }
    finally { setLoadingId(null); }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nuevo evento</button>
      {showForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><h3 className="font-serif text-xl font-bold">Nuevo evento</h3><button onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div>
        <form onSubmit={createEvent} className="mt-4 space-y-3">
          <input required placeholder="Título" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea placeholder="Descripción" className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input required type="datetime-local" className="input" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          <input placeholder="Lugar" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}</button>
        </form>
      </div></div>)}
      <div className="overflow-hidden rounded-xl border border-midrash-100 bg-white">
        <table className="min-w-full divide-y divide-midrash-100">
          <thead className="bg-midrash-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Evento</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Fecha</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Lugar</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Acciones</th></tr></thead>
          <tbody className="divide-y divide-midrash-100">
            {list.length === 0 && (<tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-midrash-500">Sin eventos.</td></tr>)}
            {list.map((e) => (<tr key={e.id}>
              <td className="px-4 py-3"><div className="font-medium text-midrash-900">{e.title}</div>{e.description && <div className="text-xs text-midrash-500">{e.description.slice(0, 60)}</div>}</td>
              <td className="px-4 py-3 text-sm">{new Date(e.event_date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="px-4 py-3 text-sm">{e.location}</td>
              <td className="px-4 py-3 text-right"><button disabled={loadingId === e.id} onClick={() => deleteEvent(e.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
