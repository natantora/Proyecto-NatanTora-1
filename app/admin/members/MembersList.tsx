"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL, ROLE_DESCRIPTION, type Role, isValidRole, assignableRolesFor } from "@/lib/permissions";

type Member = { id: string; full_name: string | null; email: string | null; phone: string | null; status: string | null; role: string | null; created_at: string | null; };
type FilterKey = "all" | "pending" | "approved" | "rejected" | "staff";

const ROLE_BADGE_COLOR: Record<Role, string> = {
  member: "bg-gray-100 text-gray-700 border-gray-300",
  rabino: "bg-blue-50 text-blue-800 border-blue-300",
  editor: "bg-purple-50 text-purple-800 border-purple-300",
  admin: "bg-orange-50 text-orange-800 border-orange-300",
  owner: "bg-gold/20 text-gold-deep border-gold",
};

const ROLE_CAPS_SUMMARY: Record<Role, string[]> = {
  member: ["Ver el contenido privado después de ser aprobado", "Sin acceso al panel administrativo"],
  rabino: ["Entrar al panel administrativo", "Subir y editar sus propias clases", "Sus clases necesitan aprobación antes de publicarse"],
  editor: ["Editar y publicar todas las clases", "Aprobar clases pendientes", "Gestionar eventos y galería", "Sin acceso a miembros, asientos ni pagos"],
  admin: ["Todo lo que puede hacer el Editor", "Aprobar o rechazar miembros", "Gestionar asientos y pagos", "No puede cambiar roles"],
  owner: ["Todo lo que puede hacer el Administrador", "Cambiar roles de otros usuarios", "El rol Propietario no se asigna desde esta pantalla"],
};

export default function MembersList({ members, currentUserRole, currentUserId }: { members: Member[]; currentUserRole: Role; currentUserId: string; }) {
  const router = useRouter();
  const [list, setList] = useState(members);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const assignable = assignableRolesFor(currentUserRole);
  const canChangeRoles = assignable.length > 0;

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setLoadingId(id); setErr(null);
    try {
      const res = await fetch("/api/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!res.ok) { const j = await res.json().catch(() => ({ error: "Error" })); throw new Error(j.error || "Error"); }
      setList((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setLoadingId(null); }
  }

  async function setRole(id: string, role: Role) {
    const labels: Record<Role, string> = { member: "Miembro (solo lectura)", rabino: "Rabino", editor: "Editor", admin: "Administrador", owner: "Propietario" };
    if (!confirm(`¿Cambiar el rol de esta persona a "${labels[role]}"?\n\n${ROLE_DESCRIPTION[role]}`)) return;
    setLoadingId(id); setErr(null);
    try {
      const res = await fetch("/api/admin/promote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role }) });
      if (!res.ok) { const j = await res.json().catch(() => ({ error: "Error" })); throw new Error(j.error || "Error"); }
      setList((prev) => prev.map((m) => m.id === id ? { ...m, role, status: role !== "member" ? "approved" : m.status } : m));
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setLoadingId(null); }
  }

  const STAFF_ROLES = ["rabino", "editor", "admin", "owner"];
  const filtered = filter === "all" ? list : filter === "staff" ? list.filter((m) => STAFF_ROLES.includes(m.role ?? "")) : list.filter((m) => m.status === filter);
  const counts = {
    all: list.length,
    pending: list.filter((m) => m.status === "pending").length,
    approved: list.filter((m) => m.status === "approved").length,
    rejected: list.filter((m) => m.status === "rejected").length,
    staff: list.filter((m) => STAFF_ROLES.includes(m.role ?? "")).length,
  };

  return (
    <div className="space-y-6">
      {err && (<div className="bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-800">{err}</div>)}

      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex flex-nowrap sm:flex-wrap gap-2 min-w-max sm:min-w-0">
        {([["all", "Todos"], ["pending", "Pendientes"], ["approved", "Aprobados"], ["rejected", "Rechazados"], ["staff", "Con rol"]] as [FilterKey, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={"shrink-0 text-[11px] tracking-[0.18em] uppercase font-semibold px-3 sm:px-4 py-2 border transition-colors duration-base ease-out-quart " + (filter === key ? "bg-navy text-cream border-navy" : "bg-cream-light text-ink-soft border-line hover:border-gold hover:text-navy")}>
            {label} ({counts[key]})
          </button>
        ))}
        </div>
      </div>

      {filtered.length === 0 && (<p className="text-[14px] text-ink-muted italic">Sin miembros en este filtro.</p>)}

      <div className="border border-line bg-cream-light">
        <div className="hidden xl:grid grid-cols-[minmax(140px,1.05fr)_minmax(180px,1.25fr)_minmax(105px,0.65fr)_minmax(220px,1.35fr)] gap-5 px-5 py-3 border-b border-line bg-cream text-[10px] tracking-[0.22em] uppercase font-bold text-ink-muted">
          <div>Miembro</div><div>Contacto</div><div>Estado</div><div>Acceso y acciones</div>
        </div>

        {filtered.map((m) => {
          const isPending = m.status === "pending";
          const memberRole = (isValidRole(m.role) ? m.role : "member") as Role;
          const isLoading = loadingId === m.id;
          const isSelf = m.id === currentUserId;
          const isOwnerTarget = memberRole === "owner";
          const isExpanded = expandedId === m.id;

          return (
            <div key={m.id} className={"border-b border-line last:border-b-0 transition-colors duration-base ease-out-quart " + (isExpanded ? "bg-white" : "hover:bg-white")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1.05fr)_minmax(180px,1.25fr)_minmax(105px,0.65fr)_minmax(220px,1.35fr)] gap-4 xl:gap-5 px-4 sm:px-5 py-5 items-start xl:items-center">
                <div className="min-w-0">
                  <div className="xl:hidden text-[9px] tracking-[0.2em] uppercase font-bold text-ink-muted mb-1">Miembro</div>
                  <div className="text-[14px] font-semibold text-navy leading-tight truncate">
                    {m.full_name || (<span className="text-ink-muted italic font-normal">(sin nombre)</span>)}
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5 tracking-wide">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : ""}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="xl:hidden text-[9px] tracking-[0.2em] uppercase font-bold text-ink-muted mb-1">Contacto</div>
                  <div className="text-[12px] text-ink leading-tight truncate">{m.email || (<span className="text-ink-muted italic">sin email</span>)}</div>
                  <div className="text-[12px] text-ink-soft mt-0.5">{m.phone || (<span className="text-ink-muted italic">sin teléfono</span>)}</div>
                </div>
                <div>
                  <div className="xl:hidden text-[9px] tracking-[0.2em] uppercase font-bold text-ink-muted mb-1">Estado</div>
                  <StatusBadge status={m.status} />
                </div>
                <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                  <div className="xl:hidden text-[9px] tracking-[0.2em] uppercase font-bold text-ink-muted mb-2">Acceso y acciones</div>
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    <span className={"inline-block text-[10px] tracking-[0.18em] uppercase font-bold px-2 py-1 border " + ROLE_BADGE_COLOR[memberRole]}>{ROLE_LABEL[memberRole]}</span>
                    <button onClick={() => setExpandedId(isExpanded ? null : m.id)} className="text-[10px] tracking-[0.16em] uppercase font-semibold text-ink-soft hover:text-gold-deep underline underline-offset-2 decoration-line" aria-expanded={isExpanded}>
                      {isExpanded ? "Ocultar permisos" : "Ver permisos"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  {isPending && (<>
                    <button disabled={isLoading} onClick={() => updateStatus(m.id, "approved")} className="text-[10px] tracking-[0.16em] uppercase font-bold bg-navy text-cream px-3 py-2 hover:bg-navy-deep transition-colors duration-base ease-out-quart disabled:opacity-50">Aprobar</button>
                    <button disabled={isLoading} onClick={() => updateStatus(m.id, "rejected")} className="text-[10px] tracking-[0.16em] uppercase font-bold text-ink-soft border border-line px-3 py-2 hover:border-ink hover:text-ink transition-colors duration-base ease-out-quart disabled:opacity-50">Rechazar</button>
                  </>)}
                  {m.status === "approved" && canChangeRoles && !isOwnerTarget && !isSelf && (
                    <select aria-label={`Cambiar rol de ${m.full_name || m.email || "miembro"}`} disabled={isLoading} value={memberRole} onChange={(e) => isValidRole(e.target.value) && setRole(m.id, e.target.value as Role)} className="w-full sm:w-auto text-[11px] tracking-wide bg-cream border border-line px-3 py-2 focus:outline-none focus:border-gold disabled:opacity-50 font-semibold text-navy">
                      <option value="" disabled>Cambiar rol…</option>
                      {assignable.map((r) => (<option key={r} value={r}>{ROLE_LABEL[r]}</option>))}
                    </select>
                  )}
                  {isOwnerTarget && (<span className="text-[10px] tracking-[0.22em] uppercase font-semibold text-gold-deep italic">Propietario</span>)}
                  {isSelf && m.status === "approved" && !isOwnerTarget && (<span className="text-[10px] tracking-[0.22em] uppercase font-semibold text-ink-muted italic">Tú mismo</span>)}
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="bg-cream border-t border-line px-4 sm:px-5 py-4">
                  <div className="text-[10px] tracking-[0.22em] uppercase font-bold text-gold-deep mb-2">Permisos de {ROLE_LABEL[memberRole]}</div>
                  <div className="text-[12px] text-ink-soft mb-3 italic leading-relaxed">{ROLE_DESCRIPTION[memberRole]}</div>
                  <ul className="space-y-1.5">
                    {ROLE_CAPS_SUMMARY[memberRole].map((cap, i) => (
                      <li key={i} className="text-[13px] text-ink flex items-start gap-2">
                        <span className={cap.startsWith("NO") ? "text-rose-600 font-bold" : "text-green-700 font-bold"}>{cap.startsWith("NO") ? "✗" : "✓"}</span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const labels: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprobado", cls: "text-green-800 border-green-300 bg-green-50" },
    pending: { label: "Pendiente", cls: "text-yellow-800 border-yellow-300 bg-yellow-50" },
    rejected: { label: "Rechazado", cls: "text-red-800 border-red-300 bg-red-50" },
  };
  const { label, cls } = labels[status ?? "pending"] ?? labels.pending;
  return (<span className={"inline-block text-[10px] tracking-[0.22em] uppercase font-bold px-2 py-1 border " + cls}>{label}</span>);
}
