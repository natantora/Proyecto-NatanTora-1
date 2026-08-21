"use client";

import { useRef, useState } from "react";
import { Armchair, Check, Loader2, MousePointer2, RectangleHorizontal, Circle, Trash2 } from "lucide-react";
import type { VenueSeat, VenueTable } from "@/lib/venue-layout";

const CANVAS_W = 1000;
const CANVAS_H = 560;

type Tool = "select" | "chair" | "rect" | "round";
type Selection = { type: "table"; id: string } | { type: "seat"; id: string } | null;

let nextId = 1;
function localId(prefix: string) {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

export default function VenueLayoutEditor({ initialTables, initialSeats }: { initialTables: VenueTable[]; initialSeats: VenueSeat[] }) {
  const [tables, setTables] = useState<VenueTable[]>(initialTables);
  const [seats, setSeats] = useState<VenueSeat[]>(initialSeats);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ type: "table" | "seat"; id: string; movedTo?: { x: number; y: number } } | null>(null);

  function pointFromEvent(e: React.MouseEvent): { x: number; y: number } {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (e.target !== svgRef.current) return; // clicks on shapes are handled by the shapes themselves
    setSaved(false);
    const { x, y } = pointFromEvent(e);
    if (tool === "chair") {
      setSeats((prev) => [...prev, { id: localId("seat"), x, y, label: String(prev.length + 1) }]);
    } else if (tool === "rect") {
      setTables((prev) => [...prev, { id: localId("table"), kind: "rect", x, y, width: 90, height: 40, rotation: 0, label: null }]);
    } else if (tool === "round") {
      setTables((prev) => [...prev, { id: localId("table"), kind: "round", x, y, width: 70, height: 70, rotation: 0, label: null }]);
    } else {
      setSelection(null);
    }
  }

  function startDrag(type: "table" | "seat", id: string) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      dragRef.current = { type, id };
      setSelection({ type, id } as Selection);
    };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = pointFromEvent(e);
    drag.movedTo = { x, y };
    if (drag.type === "seat") {
      setSeats((prev) => prev.map((s) => (s.id === drag.id ? { ...s, x, y } : s)));
    } else {
      setTables((prev) => prev.map((t) => (t.id === drag.id ? { ...t, x, y } : t)));
    }
  }

  function handleMouseUp() {
    if (dragRef.current) setSaved(false);
    dragRef.current = null;
  }

  function updateSelectedTable(patch: Partial<VenueTable>) {
    if (selection?.type !== "table") return;
    setSaved(false);
    setTables((prev) => prev.map((t) => (t.id === selection.id ? { ...t, ...patch } : t)));
  }

  function updateSelectedSeat(patch: Partial<VenueSeat>) {
    if (selection?.type !== "seat") return;
    setSaved(false);
    setSeats((prev) => prev.map((s) => (s.id === selection.id ? { ...s, ...patch } : s)));
  }

  function deleteSelected() {
    if (!selection) return;
    setSaved(false);
    if (selection.type === "table") setTables((prev) => prev.filter((t) => t.id !== selection.id));
    else setSeats((prev) => prev.filter((s) => s.id !== selection.id));
    setSelection(null);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/venue-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: tables.map(({ kind, x, y, width, height, rotation, label }) => ({ kind, x, y, width, height, rotation, label })),
          seats: seats.map(({ x, y, label }) => ({ x, y, label })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setSaved(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No fue posible guardar el plano");
    } finally {
      setSaving(false);
    }
  }

  const selectedTable = selection?.type === "table" ? tables.find((t) => t.id === selection.id) : null;
  const selectedSeat = selection?.type === "seat" ? seats.find((s) => s.id === selection.id) : null;

  const toolButtons: { key: Tool; label: string; icon: React.ReactNode }[] = [
    { key: "select", label: "Seleccionar / mover", icon: <MousePointer2 className="h-4 w-4" /> },
    { key: "chair", label: "Agregar silla", icon: <Armchair className="h-4 w-4" /> },
    { key: "rect", label: "Agregar mesa rectangular", icon: <RectangleHorizontal className="h-4 w-4" /> },
    { key: "round", label: "Agregar mesa redonda", icon: <Circle className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {toolButtons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setTool(b.key)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${tool === b.key ? "border-gold bg-gold/10 text-midrash-900" : "border-midrash-200 text-midrash-700 hover:bg-midrash-50"}`}
          >
            {b.icon} {b.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-midrash-600">{seats.length} sillas · {tables.length} mesas</span>
          <button type="button" onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <><Check className="mr-1.5 h-4 w-4" /> Guardado</> : "Guardar plano"}
          </button>
        </div>
      </div>

      {tool !== "select" ? (
        <p className="rounded-lg bg-midrash-50 px-3 py-2 text-xs text-midrash-600">
          Haz click en el plano para colocar {tool === "chair" ? "una silla" : tool === "rect" ? "una mesa rectangular" : "una mesa redonda"}. Puedes seguir haciendo click para agregar varias seguidas.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="overflow-auto rounded-xl border border-midrash-200 bg-white">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className={`w-full min-w-[700px] ${tool !== "select" ? "cursor-crosshair" : ""}`}
            style={{ backgroundImage: "radial-gradient(#e5e0d5 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {tables.map((t) => {
              const isSelected = selection?.type === "table" && selection.id === t.id;
              return (
                <g key={t.id} onMouseDown={startDrag("table", t.id)} className="cursor-move">
                  {t.kind === "rect" ? (
                    <rect
                      x={t.x - t.width / 2}
                      y={t.y - t.height / 2}
                      width={t.width}
                      height={t.height}
                      rx={3}
                      transform={`rotate(${t.rotation} ${t.x} ${t.y})`}
                      className={isSelected ? "fill-gold/25 stroke-gold-deep" : "fill-navy/10 stroke-navy/50"}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                  ) : (
                    <circle cx={t.x} cy={t.y} r={t.width / 2} className={isSelected ? "fill-gold/25 stroke-gold-deep" : "fill-navy/10 stroke-navy/50"} strokeWidth={isSelected ? 2 : 1} />
                  )}
                  {t.label ? <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none select-none fill-navy text-[10px] font-semibold">{t.label}</text> : null}
                </g>
              );
            })}
            {seats.map((s) => {
              const isSelected = selection?.type === "seat" && selection.id === s.id;
              return (
                <g key={s.id} onMouseDown={startDrag("seat", s.id)} className="cursor-move">
                  <circle cx={s.x} cy={s.y} r={10} className={isSelected ? "fill-gold stroke-gold-deep" : "fill-white stroke-navy"} strokeWidth={isSelected ? 2 : 1.2} />
                  {s.label ? <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none select-none fill-navy text-[9px] font-bold">{s.label}</text> : null}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          {selectedTable ? (
            <div className="space-y-3 rounded-xl border border-midrash-200 bg-midrash-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">{selectedTable.kind === "rect" ? "Mesa rectangular" : "Mesa redonda"}</p>
              <label className="block text-xs font-semibold text-midrash-600">
                Nombre (opcional)
                <input className="input mt-1 bg-white normal-case" value={selectedTable.label ?? ""} onChange={(e) => updateSelectedTable({ label: e.target.value || null })} />
              </label>
              {selectedTable.kind === "rect" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-midrash-600">Ancho
                    <input type="number" min={10} className="input mt-1 bg-white normal-case" value={selectedTable.width} onChange={(e) => updateSelectedTable({ width: Number(e.target.value) || 10 })} />
                  </label>
                  <label className="block text-xs font-semibold text-midrash-600">Alto
                    <input type="number" min={10} className="input mt-1 bg-white normal-case" value={selectedTable.height} onChange={(e) => updateSelectedTable({ height: Number(e.target.value) || 10 })} />
                  </label>
                </div>
              ) : (
                <label className="block text-xs font-semibold text-midrash-600">Diámetro
                  <input type="number" min={10} className="input mt-1 bg-white normal-case" value={selectedTable.width} onChange={(e) => updateSelectedTable({ width: Number(e.target.value) || 10, height: Number(e.target.value) || 10 })} />
                </label>
              )}
              <label className="block text-xs font-semibold text-midrash-600">Rotación (grados)
                <input type="number" className="input mt-1 bg-white normal-case" value={selectedTable.rotation} onChange={(e) => updateSelectedTable({ rotation: Number(e.target.value) || 0 })} />
              </label>
              <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar mesa
              </button>
            </div>
          ) : selectedSeat ? (
            <div className="space-y-3 rounded-xl border border-midrash-200 bg-midrash-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">Silla</p>
              <label className="block text-xs font-semibold text-midrash-600">
                Etiqueta
                <input className="input mt-1 bg-white normal-case" value={selectedSeat.label ?? ""} onChange={(e) => updateSelectedSeat({ label: e.target.value || null })} />
              </label>
              <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar silla
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs text-midrash-500">
              Selecciona una silla o mesa para editarla, o elige una herramienta arriba para agregar una nueva. Arrastra cualquier elemento para moverlo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
