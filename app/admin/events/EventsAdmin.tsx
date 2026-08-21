"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Loader2, X, Users, Armchair } from "lucide-react";

type SeatingMode = "none" | "open" | "assigned";
type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  seating_mode: SeatingMode;
  capacity: number | null;
};

const emptyForm = {
  title: "",
  description: "",
  event_date: "",
  location: "Midrash Natán Torá",
  seating_mode: "none" as SeatingMode,
  capacity: "",
};

export default function EventsAdmin({ initial, venueSeatCount }: { initial: EventRow[]; venueSeatCount: number }) {
  const [list, setList] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, event_date: new Date(form.event_date).toISOString() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setList((previous) => [body.event, ...previous]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error creando evento");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("¿Eliminar este evento y todas sus reservaciones?")) return;
    setLoadingId(id);
    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setList((previous) => previous.filter((event) => event.id !== id));
    } catch {
      alert("No fue posible eliminar el evento");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <button onClick={() => setShowForm(true)} className="btn-primary">
        <Plus className="mr-2 h-4 w-4" /> Nuevo evento
      </button>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-2xl font-bold text-midrash-900">Nuevo evento</h3>
                <p className="mt-1 text-sm text-midrash-600">Elige aquí si necesita reservaciones y cómo se asignarán.</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-midrash-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={createEvent} className="mt-6 space-y-4">
              <input required placeholder="Título" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea placeholder="Descripción" className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-midrash-600">
                  Fecha y hora
                  <input required type="datetime-local" className="input mt-1.5 normal-case" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-midrash-600">
                  Lugar
                  <input className="input mt-1.5 normal-case" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-midrash-600">Tipo de acceso</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["none", "Sin reservación", "Solo se publica el evento."],
                    ["open", "Lugar libre", "Se controla el cupo, sin asignar asiento."],
                    ["assigned", "Con plano", "Cada persona elige su asiento."],
                  ].map(([value, title, description]) => (
                    <label key={value} className={`cursor-pointer rounded-xl border p-4 transition-colors ${form.seating_mode === value ? "border-gold bg-gold/10" : "border-midrash-100 hover:border-gold/50"}`}>
                      <input type="radio" name="seating_mode" value={value} checked={form.seating_mode === value} onChange={() => setForm({ ...form, seating_mode: value as SeatingMode })} className="sr-only" />
                      <span className="block text-sm font-bold text-midrash-900">{title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-midrash-600">{description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {form.seating_mode === "open" ? (
                <label className="block rounded-xl border border-midrash-100 bg-midrash-50 p-4 text-xs font-semibold uppercase tracking-wide text-midrash-600">
                  Cupo total
                  <input required min={1} max={1000} type="number" className="input mt-1.5 bg-white normal-case" placeholder="Ej. 120" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  <span className="mt-2 block normal-case font-normal">Las personas apartan un lugar, pero no reciben un número de asiento.</span>
                </label>
              ) : null}

              {form.seating_mode === "assigned" ? (
                <div className="rounded-xl border border-midrash-100 bg-midrash-50 p-4">
                  {venueSeatCount > 0 ? (
                    <p className="text-sm text-midrash-700">Se usará el plano real del salón: <strong>{venueSeatCount}</strong> lugares configurados.</p>
                  ) : (
                    <p className="text-sm text-red-700">
                      Todavía no configuraste el mapa de asientos del salón.{" "}
                      <Link href="/admin/seats" className="underline">Configúralo aquí</Link> antes de crear un evento con plano.
                    </p>
                  )}
                </div>
              ) : null}

              <button type="submit" disabled={submitting || (form.seating_mode === "assigned" && venueSeatCount === 0)} className="btn-primary w-full justify-center">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear evento"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-midrash-100 bg-white">
        <table className="min-w-[760px] w-full divide-y divide-midrash-100">
          <thead className="bg-midrash-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Evento</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Reservación</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-midrash-100">
            {list.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-midrash-500">Sin eventos.</td></tr> : null}
            {list.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-midrash-900">{event.title}</div>
                  <div className="text-xs text-midrash-500">{event.location}</div>
                </td>
                <td className="px-4 py-3 text-sm">{new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3 text-sm">
                  {event.seating_mode === "open" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"><Users className="h-3.5 w-3.5" /> Lugar libre · {event.capacity}</span>
                  ) : event.seating_mode === "assigned" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><Armchair className="h-3.5 w-3.5" /> Plano · {event.capacity}</span>
                  ) : (
                    <span className="text-xs text-midrash-500">Sin reservación</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link href={`/eventos/${event.id}`} className="rounded px-2 py-1 text-xs font-semibold text-midrash-700 hover:bg-midrash-50">Ver</Link>
                    <button disabled={loadingId === event.id} onClick={() => deleteEvent(event.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label={`Eliminar ${event.title}`}>
                      {loadingId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
