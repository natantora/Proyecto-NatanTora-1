/**
 * Sistema centralizado de permisos por rol.
 *
 * JERARQUÍA DE ROLES (de menor a mayor):
 *   member  → solo lectura, después de ser aprobado
 *   rabino  → crea SUS clases (todas requieren aprobación de admin/editor/owner)
 *   editor  → gestiona contenido público (clases, horarios, eventos, galería)
 *   admin   → todo: contenido + miembros + pagos + reservaciones
 *   owner   → todo + promover/demoler otros usuarios
 *
 * Solo los owners pueden cambiar el rol de otros. Los admins NO pueden
 * promover ni demoler (evita escalación accidental).
 */

export type Role = "member" | "rabino" | "editor" | "admin" | "owner";

export const ALL_ROLES: Role[] = ["member", "rabino", "editor", "admin", "owner"];

export function isValidRole(r: string | null | undefined): r is Role {
  return !!r && (ALL_ROLES as string[]).includes(r);
}

export const ROLE_LABEL: Record<Role, string> = {
  member: "Miembro",
  rabino: "Rabino",
  editor: "Editor",
  admin: "Administrador",
  owner: "Propietario",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  member: "Solo lectura. Ve horarios, clases, eventos y galería.",
  rabino: "Sube sus propias clases. Todas pasan por aprobación.",
  editor: "Gestiona clases (todas), horarios, eventos y galería.",
  admin: "Acceso completo: contenido, miembros, pagos y reservaciones.",
  owner: "Acceso completo + puede asignar roles a otros usuarios.",
};

/* ---------------- Capacidades ---------------- */

/** Acceso al panel /admin/* (cualquiera distinto de member) */
export function canAccessAdminPanel(role: Role | null | undefined): boolean {
  return role === "rabino" || role === "editor" || role === "admin" || role === "owner";
}

/** Crear/editar SUS propias clases (siempre con flag pending_review si rabino) */
export function canCreateOwnClasses(role: Role | null | undefined): boolean {
  return role === "rabino" || role === "editor" || role === "admin" || role === "owner";
}

/** Editar TODAS las clases (incluso ajenas) */
export function canEditAllClasses(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

/** Aprobar/rechazar clases pendientes */
export function canReviewClasses(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

/** Publicar directo sin pasar por review */
export function canPublishDirectly(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

/** Editar horarios de rezos y zemanim del Midrash */
export function canEditHorarios(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

/** Crear/editar eventos */
export function canEditEvents(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

/** Gestionar galería de fotos */
export function canEditGallery(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

/** Vender/configurar asientos para fiestas mayores */
export function canManageSeats(role: Role | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** Ver y procesar pagos */
export function canManagePayments(role: Role | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** Aprobar/rechazar miembros nuevos */
export function canManageMembers(role: Role | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** Cambiar el rol de otros usuarios (asignar admin/editor/rabino) */
export function canPromoteUsers(role: Role | null | undefined): boolean {
  return role === "owner";
}

/* ---------------- Validación de asignación ---------------- */

/**
 * ¿Puede `actorRole` asignar `targetRole` a alguien más?
 * Solo owners pueden asignar roles. Y nadie puede asignar owner directamente
 * por API — la promoción a owner se hace por SQL manual (medida de seguridad).
 */
export function canAssignRole(
  actorRole: Role | null | undefined,
  targetRole: Role
): boolean {
  if (!canPromoteUsers(actorRole)) return false;
  // owners no se crean por API — solo por SQL inicial. Esto protege contra
  // escalación accidental: un owner comprometido no puede crear más owners.
  if (targetRole === "owner") return false;
  return ["member", "rabino", "editor", "admin"].includes(targetRole);
}

/** Roles que un actor puede asignar via UI */
export function assignableRolesFor(actorRole: Role | null | undefined): Role[] {
  if (!canPromoteUsers(actorRole)) return [];
  return ["member", "rabino", "editor", "admin"];
}
