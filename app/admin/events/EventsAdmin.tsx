"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Loader2, X, Users, Armchair, Send, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { formatMXN } from "@/lib/utils";

type SeatingMode = "none" | "open" | "assigned";
type SeatPlanType = "architectural" | "custom";
type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  seating_mode: SeatingMode;
  seat_plan_type: SeatPlanType;
  capacity: number | null;
  seat_price: number | string;
  published: boolean;
  published_at: string | null;
  reservations_open: boolean;
};

const emptyForm = {
  title: "",
  description: "",
  event_date: "",
  location: "Midrash Natán Torá",
  seating_mode: "none" as SeatingMode,
  seat_plan_type: "architectural" as SeatPlanType,
  capacity: "",
  seat_price: "0",
};

export default function EventsAdmin({ initial, architecturalSeatCount, customSeatCount }: { initial: EventRow[]; architecturalSeatCount: number; customSeatCount: number }) {
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

  async function transitionEvent(id: string, action: "publish" | "open_reservations" | "close_reservations") {
    setLoadingId(id);
    try {
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setList((previous) => previous.map((event) => event.id === id ? body.event : event));
    } catch (error) {
      alert(error instanceof Error ? error.message : "No fue posible actualizar el evento");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {[['1', 'Crear', 'Guarda el evento como borrador.'], ['2', 'Publicar', 'Lo muestra en la página pública.'], ['3', 'Abrir reservaciones', 'Permite que las personas aparten lugares.']].map(([number, title, description]) => (
          <div key={number} className="flex gap-3 rounded-xl border border-midrash-100 bg-white p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">{number}</span><div><div className="text-sm font-bold text-navy">{title}</div><div className="mt-0.5 text-xs text-midrash-500">{description}</div></div></div>
        ))}
      </div>
      <button onClick={() => setShowForm(true)} className="btn-primary">
        <Plus className="mr-2 h-4 w-4" /> Nuevo evento
      </button>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-2xl font-bold text-midrash-900">Nuevo evento</h3>
                <p className="mt-1 text-sm text-midrash-600">Primero se guarda como borrador. Después podrás publicarlo y abrir las reservaciones.</p>
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
                <div className="grid gap-3 rounded-xl border border-midrash-100 bg-midrash-50 p-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-midrash-600">
                    Cupo total
                    <input required min={1} max={1000} type="number" className="input mt-1.5 bg-white normal-case" placeholder="Ej. 120" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                    <span className="mt-2 block normal-case font-normal">Cada persona aparta un lugar sin número de asiento.</span>
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-midrash-600">
                    Precio por lugar (MXN)
                    <input required min={0} max={1000000} step="0.01" type="number" className="input mt-1.5 bg-white normal-case" placeholder="Ej. 500" value={form.seat_price} onChange={(e) => setForm({ ...form, seat_price: e.target.value })} />
                    <span className="mt-2 block normal-case font-normal">Escribe 0 si es gratuito.</span>
                  </label>
                </div>
              ) : null}

              {form.seating_mode === "assigned" ? (
                <div className="space-y-3 rounded-xl border border-midrash-100 bg-midrash-50 p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-midrash-600">
                    Precio por asiento (MXN)
                    <input required min={0} max={1000000} step="0.01" type="number" className="input mt-1.5 bg-white normal-case" placeholder="Ej. 500" value={form.seat_price} onChange={(e) => setForm({ ...form, seat_price: e.target.value })} />
                    <span className="mt-2 block normal-case font-normal">Escribe 0 si el evento es gratuito. El cobro en línea se configurará por separado.</span>
                  </label>
                  {architecturalSeatCount > 0 ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">Plano para este evento</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={`cursor-pointer rounded-xl border bg-white p-4 transition-colors ${form.seat_plan_type === "architectural" ? "border-gold ring-1 ring-gold/40" : "border-midrash-100 hover:border-gold/50"}`}>
                          <input type="radio" name="seat_plan_type" className="sr-only" checked={form.seat_plan_type === "architectural"} onChange={() => setForm({ ...form, seat_plan_type: "architectural" })} />
                          <span className="block text-sm font-bold text-midrash-900">Plano original</span>
                          <span className="mt-1 block text-xs leading-relaxed text-midrash-600">Las personas tocan directamente una silla en el archivo real del salón.</span>
                        </label>
                        <label className={`cursor-pointer rounded-xl border bg-white p-4 transition-colors ${form.seat_plan_type === "custom" ? "border-gold ring-1 ring-gold/40" : "border-midrash-100 hover:border-gold/50"}`}>
                          <input type="radio" name="seat_plan_type" className="sr-only" checked={form.seat_plan_type === "custom"} onChange={() => setForm({ ...form, seat_plan_type: "custom" })} />
                          <span className="block text-sm font-bold text-midrash-900">Plano personalizado</span>
                          <span className="mt-1 block text-xs leading-relaxed text-midrash-600">Usa el plano preparado en el editor para eventos con otra distribución.</span>
                        </label>
                      </div>
                      <p className="text-xs text-midrash-500">
                        {form.seat_plan_type === "architectural" ? (
                          <><strong>{architecturalSeatCount}</strong> sillas detectadas directamente en el archivo original.</>
                        ) : (
                          <><strong>{customSeatCount}</strong> lugares configurados en el editor.</>
                        )}
                      </p>
                      {form.seat_plan_type === "custom" && customSeatCount === 0 ? (
                        <p className="text-sm text-red-700">
                          Todavía no configuraste el plano personalizado.{" "}
                          <Link href="/admin/seats" className="underline">Configúralo aquí</Link> antes de crear este evento.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-red-700">
                      Todavía no configuraste el mapa de asientos del salón.{" "}
                      <Link href="/admin/seats" className="underline">Configúralo aquí</Link> antes de crear un evento con plano.
                    </p>
                  )}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || (form.seating_mode === "assigned" && (form.seat_plan_type === "architectural" ? architecturalSeatCount === 0 : customSeatCount === 0))}
                className="btn-primary w-full justify-center"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear borrador"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-midrash-100 bg-white">
        <table className="min-w-[940px] w-full divide-y divide-midrash-100">
          <thead className="bg-midrash-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Evento</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-midrash-600">Reservación</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-midrash-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-midrash-100">
            {list.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-midrash-500">Sin eventos.</td></tr> : null}
            {list.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-midrash-900">{event.title}</div>
                  <div className="text-xs text-midrash-500">{event.location}</div>
                </td>
                <td className="px-4 py-3 text-sm">{new Date(event.event_date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3 text-sm">
                  {!event.published ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Borrador</span>
                  ) : event.reservations_open ? (
                    <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Reservaciones abiertas</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Publicado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {event.seating_mode === "open" ? (
                    <div className="space-y-1"><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"><Users className="h-3.5 w-3.5" /> Lugar libre · {event.capacity}</span><div className="text-xs text-midrash-500">{Number(event.seat_price) > 0 ? `${formatMXN(Number(event.seat_price))} por lugar` : "Gratuito"}</div></div>
                  ) : event.seating_mode === "assigned" ? (
                    <div className="space-y-1"><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><Armchair className="h-3.5 w-3.5" /> {event.seat_plan_type === "custom" ? "Plano personalizado" : "Plano original"} · {event.capacity}</span><div className="text-xs text-midrash-500">{Number(event.seat_price) > 0 ? `${formatMXN(Number(event.seat_price))} por asiento` : "Gratuito"}</div></div>
                  ) : (
                    <span className="text-xs text-midrash-500">Sin reservación</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    {!event.published ? (
                      <button disabled={loadingId === event.id} onClick={() => transitionEvent(event.id, "publish")} className="inline-flex items-center gap-1 rounded bg-navy px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-soft"><Send className="h-3.5 w-3.5" /> Publicar</button>
                    ) : event.seating_mode !== "none" && !event.reservations_open ? (
                      <button disabled={loadingId === event.id} onClick={() => transitionEvent(event.id, "open_reservations")} className="inline-flex items-center gap-1 rounded bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-800"><UnlockKeyhole className="h-3.5 w-3.5" /> Abrir reservaciones</button>
                    ) : event.reservations_open ? (
                      <button disabled={loadingId === event.id} onClick={() => transitionEvent(event.id, "close_reservations")} className="inline-flex items-center gap-1 rounded bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"><LockKeyhole className="h-3.5 w-3.5" /> Cerrar</button>
                    ) : null}
                    <Link href={`/admin/events/${event.id}`} className="rounded px-2 py-1 text-xs font-semibold text-midrash-700 hover:bg-midrash-50">Ver</Link>
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
