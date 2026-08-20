"use client";

import { useState } from "react";
import { ROLE_LABEL, ROLE_DESCRIPTION, type Role } from "@/lib/permissions";

type Capability = {
  key: string;
  label: string;
  roles: Role[];
};

const CAPABILITIES: Capability[] = [
  { key: "view", label: "Ver páginas privadas (horarios, clases, eventos, galería)", roles: ["member", "rabino", "editor", "admin", "owner"] },
  { key: "own_classes", label: "Subir sus propias clases (con aprobación)", roles: ["rabino", "editor", "admin", "owner"] },
  { key: "review_classes", label: "Revisar / aprobar clases pendientes", roles: ["editor", "admin", "owner"] },
  { key: "edit_all_classes", label: "Editar / publicar / borrar cualquier clase", roles: ["editor", "admin", "owner"] },
  { key: "schedule", label: "Editar horarios de rezos y zemanim", roles: ["editor", "admin", "owner"] },
  { key: "events", label: "Crear eventos y configurar lugar libre o plano", roles: ["editor", "admin", "owner"] },
  { key: "gallery", label: "Gestionar galería de fotos", roles: ["editor", "admin", "owner"] },
  { key: "payments", label: "Ver y procesar pagos", roles: ["admin", "owner"] },
  { key: "members", label: "Aprobar / rechazar nuevos miembros", roles: ["admin", "owner"] },
  { key: "promote", label: "Asignar roles a otros usuarios", roles: ["owner"] },
];

const ROLE_ORDER: Role[] = ["member", "rabino", "editor", "admin", "owner"];

const ROLE_COLOR: Record<Role, string> = {
  member: "bg-gray-100 text-gray-700",
  rabino: "bg-blue-50 text-blue-800",
  editor: "bg-purple-50 text-purple-800",
  admin: "bg-orange-50 text-orange-800",
  owner: "bg-gold/20 text-gold-deep",
};

const ROLE_SUMMARY: Record<Role, string[]> = {
  member: ["Contenido privado aprobado", "Sin panel administrativo"],
  rabino: ["Sus propias clases", "Publicación con aprobación"],
  editor: ["Clases y revisiones", "Eventos y galería"],
  admin: ["Contenido y miembros", "Reservaciones y pagos"],
  owner: ["Todo el sistema", "Asignación de roles"],
};

export default function RolePermissionsMatrix({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-line bg-cream-light">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-cream transition-colors duration-base ease-out-quart">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase font-bold text-gold-deep mb-1">Tabla de roles y permisos</div>
          <div className="text-[13px] text-ink-soft">{open ? "Toca para ocultar" : "Toca para ver qué puede hacer cada rol"}</div>
        </div>
        <span className="text-[18px] text-gold-deep font-light">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-line p-5 lg:p-7 space-y-6 bg-cream">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {ROLE_ORDER.map((r) => (
              <div key={r} className={`p-3 border border-line ${ROLE_COLOR[r]}`}>
                <div className="text-[10px] tracking-[0.22em] uppercase font-bold mb-1">{ROLE_LABEL[r]}</div>
                <div className="text-[12px] leading-snug">{ROLE_DESCRIPTION[r]}</div>
                <ul className="mt-2 space-y-1">
                  {ROLE_SUMMARY[r].map((item) => (
                    <li key={item} className="text-[11px] leading-snug flex gap-1.5"><span aria-hidden="true">•</span><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto -mx-5 px-5 lg:mx-0 lg:px-0 pb-2" role="region" aria-label="Comparación detallada de permisos" tabIndex={0}>
            <table className="w-full min-w-[760px] text-[12px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-2 px-3 text-[10px] tracking-[0.22em] uppercase font-bold text-ink-muted">Permiso</th>
                  {ROLE_ORDER.map((r) => (
                    <th key={r} className="text-center py-2 px-2 text-[10px] tracking-[0.22em] uppercase font-bold text-ink-muted">{ROLE_LABEL[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((cap) => (
                  <tr key={cap.key} className="border-b border-line-soft hover:bg-cream-light">
                    <td className="py-2.5 px-3 text-ink leading-snug">{cap.label}</td>
                    {ROLE_ORDER.map((r) => (
                      <td key={r} className="text-center py-2.5 px-2">
                        {cap.roles.includes(r) ? <span className="text-green-700 font-bold">✓</span> : <span className="text-ink-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 text-[11px] text-ink-muted leading-relaxed">
            <p>Solo los <strong>propietarios</strong> pueden cambiar el rol de otros usuarios. El rol &quot;Propietario&quot; no se asigna desde el panel (por seguridad).</p>
            <p><strong>Nota:</strong> el permiso para editar horarios ya está definido, pero la pantalla de edición de horarios todavía está pendiente de construcción.</p>
          </div>
        </div>
      )}
    </div>
  );
}
