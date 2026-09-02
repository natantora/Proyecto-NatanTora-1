"use client";

import { useRef, useState } from "react";
import { Armchair, Check, Loader2, Minus, MousePointer2, RectangleHorizontal, Circle, RotateCw, Trash2, Image as ImageIcon, ListOrdered } from "lucide-react";
import type { VenueSeat, VenueTable } from "@/lib/venue-layout";
import { CANVAS_W, CANVAS_H, NEIGHBOR_SNAP, snapToGrid } from "@/lib/venue-canvas";
import { nextNumericSeatLabel, renumberSeatsByVisualOrder } from "@/lib/seat-numbering";
import CustomPlanFloorZone from "@/components/CustomPlanFloorZone";

type Tool = "select" | "chair" | "rect" | "round" | "wall";
type Selection = { type: "table"; id: string } | { type: "seat"; id: string } | null;
type Point = { x: number; y: number };

let nextId = 1;
function localId(prefix: string) {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

function ChairShape({ x, y, rotation, selected }: { x: number; y: number; rotation: number; selected: boolean }) {
  const cls = selected ? "fill-gold/70 stroke-gold-deep" : "fill-white stroke-navy";
  return (
    <g transform={`rotate(${rotation} ${x} ${y})`}>
      <rect x={x - 9} y={y - 10} width={18} height={3.5} rx={1} className={cls} strokeWidth={selected ? 1.6 : 1} />
      <rect x={x - 8} y={y - 7} width={16} height={16} rx={2.5} className={cls} strokeWidth={selected ? 1.6 : 1} />
    </g>
  );
}

export default function VenueLayoutEditor({ initialTables, initialSeats }: { initialTables: VenueTable[]; initialSeats: VenueSeat[] }) {
  const [tables, setTables] = useState<VenueTable[]>(initialTables);
  const [seats, setSeats] = useState<VenueSeat[]>(initialSeats);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBg, setShowBg] = useState(true);
  const [bgOpacity, setBgOpacity] = useState(0.55);
  const [wallDraft, setWallDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [guide, setGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ type: "table" | "seat"; id: string } | null>(null);
  const wallStartRef = useRef<Point | null>(null);

  function pointFromEvent(e: React.MouseEvent): Point {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return { x, y };
  }

  function snapPoint(x: number, y: number, excludeId?: string): { x: number; y: number; guideX: number | null; guideY: number | null } {
    let sx = snapToGrid(x);
    let sy = snapToGrid(y);
    let guideX: number | null = null;
    let guideY: number | null = null;
    let bestDx = NEIGHBOR_SNAP;
    let bestDy = NEIGHBOR_SNAP;
    const candidates: Point[] = [
      ...seats.filter((s) => s.id !== excludeId).map((s) => ({ x: s.x, y: s.y })),
      ...tables.filter((t) => t.id !== excludeId).map((t) => ({ x: t.x, y: t.y })),
    ];
    for (const c of candidates) {
      const dx = Math.abs(c.x - x);
      if (dx < bestDx) { bestDx = dx; sx = c.x; guideX = c.x; }
      const dy = Math.abs(c.y - y);
      if (dy < bestDy) { bestDy = dy; sy = c.y; guideY = c.y; }
    }
    return { x: sx, y: sy, guideX, guideY };
  }

  function handleCanvasMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.target !== svgRef.current) return;
    if (tool !== "wall") return;
    const p = pointFromEvent(e);
    wallStartRef.current = p;
    setWallDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }

  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (e.target !== svgRef.current) return;
    if (tool === "wall") return;
    setSaved(false);
    const raw = pointFromEvent(e);
    const { x, y } = snapPoint(raw.x, raw.y);
    if (tool === "chair") {
      setSeats((prev) => [...prev, { id: localId("seat"), x, y, rotation: 0, label: nextNumericSeatLabel(prev) }]);
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
      if (tool !== "select") return;
      dragRef.current = { type, id };
      setSelection({ type, id } as Selection);
    };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (wallStartRef.current) {
      const raw = pointFromEvent(e);
      const snapped = snapPoint(raw.x, raw.y);
      setWallDraft({ x1: wallStartRef.current.x, y1: wallStartRef.current.y, x2: snapped.x, y2: snapped.y });
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const raw = pointFromEvent(e);
    const { x, y, guideX, guideY } = snapPoint(raw.x, raw.y, drag.id);
    setGuide({ x: guideX, y: guideY });
    if (drag.type === "seat") setSeats((prev) => prev.map((s) => (s.id === drag.id ? { ...s, x, y } : s)));
    else setTables((prev) => prev.map((t) => (t.id === drag.id ? { ...t, x, y } : t)));
  }

  function handleMouseUp() {
    if (wallStartRef.current && wallDraft) {
      const dx = wallDraft.x2 - wallDraft.x1;
      const dy = wallDraft.y2 - wallDraft.y1;
      const length = Math.hypot(dx, dy);
      if (length > 8) {
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        setTables((prev) => [
          ...prev,
          { id: localId("wall"), kind: "wall", x: (wallDraft.x1 + wallDraft.x2) / 2, y: (wallDraft.y1 + wallDraft.y2) / 2, width: length, height: 8, rotation: angle, label: null },
        ]);
        setSaved(false);
      }
      wallStartRef.current = null;
      setWallDraft(null);
      return;
    }
    if (dragRef.current) setSaved(false);
    dragRef.current = null;
    setGuide({ x: null, y: null });
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

  function renumberSeats() {
    setSeats((prev) => renumberSeatsByVisualOrder(prev));
    setSelection(null);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/venue-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: tables.map(({ kind, x, y, width, height, rotation, label }) => ({ kind, x, y, width, height, rotation, label })),
          seats: seats.map(({ x, y, rotation, label }) => ({ x, y, rotation, label })),
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
  const wallCount = tables.filter((t) => t.kind === "wall").length;
  const furnitureCount = tables.length - wallCount;

  const toolButtons: { key: Tool; label: string; icon: React.ReactNode }[] = [
    { key: "select", label: "Seleccionar / mover", icon: <MousePointer2 className="h-4 w-4" /> },
    { key: "chair", label: "Agregar silla", icon: <Armchair className="h-4 w-4" /> },
    { key: "rect", label: "Agregar mesa rectangular", icon: <RectangleHorizontal className="h-4 w-4" /> },
    { key: "round", label: "Agregar mesa redonda", icon: <Circle className="h-4 w-4" /> },
    { key: "wall", label: "Dibujar pared", icon: <Minus className="h-4 w-4" /> },
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
        <button
          type="button"
          onClick={() => setShowBg((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${showBg ? "border-gold bg-gold/10 text-midrash-900" : "border-midrash-200 text-midrash-700 hover:bg-midrash-50"}`}
        >
          <ImageIcon className="h-4 w-4" /> Plano de fondo
        </button>
        {showBg ? (
          <label className="flex items-center gap-1.5 text-xs text-midrash-600">
            Opacidad
            <input type="range" min={0.1} max={1} step={0.05} value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} />
          </label>
        ) : null}
        <button
          type="button"
          onClick={renumberSeats}
          disabled={seats.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-midrash-200 px-3 py-2 text-xs font-semibold text-midrash-700 hover:bg-midrash-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Numera por columnas, desde la derecha hacia la izquierda"
        >
          <ListOrdered className="h-4 w-4" /> Ordenar números
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-midrash-600">{seats.length} sillas · {furnitureCount} mesas · {wallCount} paredes</span>
          <button type="button" onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <><Check className="mr-1.5 h-4 w-4" /> Guardado</> : "Guardar plano"}
          </button>
        </div>
      </div>

      {tool !== "select" ? (
        <p className="rounded-lg bg-midrash-50 px-3 py-2 text-xs text-midrash-600">
          {tool === "wall"
            ? "Arrastra desde un punto hasta otro para dibujar una pared."
            : `Haz click en el plano para colocar ${tool === "chair" ? "una silla" : tool === "rect" ? "una mesa rectangular" : "una mesa redonda"}. Puedes seguir haciendo click para agregar varias seguidas.`}
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
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {showBg ? (
              <image href="/venue-plan-reference.png" x={0} y={0} width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="none" opacity={bgOpacity} className="pointer-events-none" />
            ) : null}

            <CustomPlanFloorZone opacity={showBg ? 0.58 : 0.78} />

            {guide.x !== null ? <line x1={guide.x} y1={0} x2={guide.x} y2={CANVAS_H} className="stroke-red-400" strokeWidth={1} strokeDasharray="4 3" /> : null}
            {guide.y !== null ? <line x1={0} y1={guide.y} x2={CANVAS_W} y2={guide.y} className="stroke-red-400" strokeWidth={1} strokeDasharray="4 3" /> : null}

            {tables.map((t) => {
              const isSelected = selection?.type === "table" && selection.id === t.id;
              if (t.kind === "wall") {
                return (
                  <g key={t.id} onMouseDown={startDrag("table", t.id)} className="cursor-move">
                    <rect
                      x={t.x - t.width / 2}
                      y={t.y - t.height / 2}
                      width={t.width}
                      height={t.height}
                      transform={`rotate(${t.rotation} ${t.x} ${t.y})`}
                      className={isSelected ? "fill-gold-deep stroke-gold-deep" : "fill-navy stroke-navy"}
                    />
                  </g>
                );
              }
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

            {wallDraft ? (
              <line x1={wallDraft.x1} y1={wallDraft.y1} x2={wallDraft.x2} y2={wallDraft.y2} className="stroke-navy" strokeWidth={8} strokeLinecap="round" opacity={0.6} />
            ) : null}

            {seats.map((s) => {
              const isSelected = selection?.type === "seat" && selection.id === s.id;
              return (
                <g key={s.id} onMouseDown={startDrag("seat", s.id)} className="cursor-move">
                  <ChairShape x={s.x} y={s.y} rotation={s.rotation} selected={isSelected} />
                  {s.label ? <text x={s.x} y={s.y + 1} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none select-none fill-navy text-[8px] font-bold">{s.label}</text> : null}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          {selectedTable ? (
            <div className="space-y-3 rounded-xl border border-midrash-200 bg-midrash-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">
                {selectedTable.kind === "rect" ? "Mesa rectangular" : selectedTable.kind === "round" ? "Mesa redonda" : "Pared"}
              </p>
              {selectedTable.kind !== "wall" ? (
                <label className="block text-xs font-semibold text-midrash-600">
                  Nombre (opcional)
                  <input className="input mt-1 bg-white normal-case" value={selectedTable.label ?? ""} onChange={(e) => updateSelectedTable({ label: e.target.value || null })} />
                </label>
              ) : null}
              {selectedTable.kind === "rect" || selectedTable.kind === "wall" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold text-midrash-600">{selectedTable.kind === "wall" ? "Largo" : "Ancho"}
                    <input type="number" min={4} className="input mt-1 bg-white normal-case" value={selectedTable.width} onChange={(e) => updateSelectedTable({ width: Number(e.target.value) || 4 })} />
                  </label>
                  <label className="block text-xs font-semibold text-midrash-600">{selectedTable.kind === "wall" ? "Grosor" : "Alto"}
                    <input type="number" min={4} className="input mt-1 bg-white normal-case" value={selectedTable.height} onChange={(e) => updateSelectedTable({ height: Number(e.target.value) || 4 })} />
                  </label>
                </div>
              ) : (
                <label className="block text-xs font-semibold text-midrash-600">Diámetro
                  <input type="number" min={10} className="input mt-1 bg-white normal-case" value={selectedTable.width} onChange={(e) => updateSelectedTable({ width: Number(e.target.value) || 10, height: Number(e.target.value) || 10 })} />
                </label>
              )}
              <label className="block text-xs font-semibold text-midrash-600">Rotación (grados)
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" className="input bg-white normal-case" value={selectedTable.rotation} onChange={(e) => updateSelectedTable({ rotation: Number(e.target.value) || 0 })} />
                  <button type="button" onClick={() => updateSelectedTable({ rotation: (selectedTable.rotation + 90) % 360 })} className="shrink-0 rounded-lg border border-midrash-200 p-2 hover:bg-white" aria-label="Girar 90 grados">
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
              </label>
              <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar {selectedTable.kind === "wall" ? "pared" : "mesa"}
              </button>
            </div>
          ) : selectedSeat ? (
            <div className="space-y-3 rounded-xl border border-midrash-200 bg-midrash-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midrash-600">Silla</p>
              <label className="block text-xs font-semibold text-midrash-600">
                Etiqueta
                <input className="input mt-1 bg-white normal-case" value={selectedSeat.label ?? ""} onChange={(e) => updateSelectedSeat({ label: e.target.value || null })} />
              </label>
              <label className="block text-xs font-semibold text-midrash-600">Orientación (grados)
                <div className="mt-1 flex items-center gap-2">
                  <input type="number" className="input bg-white normal-case" value={selectedSeat.rotation} onChange={(e) => updateSelectedSeat({ rotation: Number(e.target.value) || 0 })} />
                  <button type="button" onClick={() => updateSelectedSeat({ rotation: (selectedSeat.rotation + 90) % 360 })} className="shrink-0 rounded-lg border border-midrash-200 p-2 hover:bg-white" aria-label="Girar 90 grados">
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
              </label>
              <button type="button" onClick={deleteSelected} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar silla
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-midrash-200 p-4 text-xs text-midrash-500">
              Selecciona una silla, mesa o pared para editarla, o elige una herramienta arriba para agregar una nueva. Arrastra cualquier elemento para moverlo — se alinea solo con los elementos cercanos y con la cuadrícula.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
