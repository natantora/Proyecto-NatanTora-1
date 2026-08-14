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
  { key: "events", label: "Crear / editar eventos comunitarios", roles: ["editor", "admin", "owner"] },
  { key: "gallery", label: "Gestionar galería de fotos", roles: ["editor", "admin", "owner"] },
  { key: "seats", label: "Vender / configurar asientos para fiestas", roles: ["admin", "owner"] },
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_ORDER.map((r) => (
              <div key={r} className={`p-3 border border-line ${ROLE_COLOR[r]}`}>
                <div className="text-[10px] tracking-[0.22em] uppercase font-bold mb-1">{ROLE_LABEL[r]}</div>
                <div className="text-[12px] leading-snug">{ROLE_DESCRIPTION[r]}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto -mx-5 lg:mx-0">
            <table className="w-full text-[12px]">
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
          <p className="text-[11px] text-ink-muted leading-relaxed">Solo los <strong>propietarios</strong> pueden cambiar el rol de otros usuarios. El rol &quot;Propietario&quot; no se asigna desde el panel (por seguridad); se hace por SQL directo en la base de datos.</p>
        </div>
      )}
    </div>
  );
}
