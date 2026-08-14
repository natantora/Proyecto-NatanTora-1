import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import {
  canAccessAdminPanel,
  canEditAllClasses,
  canEditHorarios,
  canEditEvents,
  canEditGallery,
  canManageSeats,
  canManagePayments,
  canManageMembers,
  canReviewClasses,
  ROLE_LABEL,
  type Role,
} from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  show: boolean;
  badge?: number;
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/admin/dashboard");

  const role = await getUserRole(user.id);
  if (!canAccessAdminPanel(role)) redirect("/?error=admin_only");

  // Contar items pendientes para badges
  const admin = createAdminClient();
  let pendingClassesCount = 0;
  let pendingMembersCount = 0;

  if (canReviewClasses(role)) {
    const { count } = await admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("pending_review", true);
    pendingClassesCount = count ?? 0;
  }
  if (canManageMembers(role)) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingMembersCount = count ?? 0;
  }

  const nav: NavItem[] = [
    { href: "/admin/dashboard", label: "Dashboard", show: true },
    {
      href: "/admin/members",
      label: "Miembros",
      show: canManageMembers(role),
      badge: pendingMembersCount,
    },
    {
      href: role === "rabino" ? "/admin/classes/mis-clases" : "/admin/classes",
      label: role === "rabino" ? "Mis clases" : "Clases",
      show: true, // todos los del panel ven al menos sus clases
    },
    {
      href: "/admin/classes/pending",
      label: "Pendientes de revisión",
      show: canReviewClasses(role),
      badge: pendingClassesCount,
    },
    {
      href: "/admin/events",
      label: "Eventos",
      show: canEditEvents(role),
    },
    {
      href: "/admin/gallery",
      label: "Galería",
      show: canEditGallery(role),
    },
    {
      href: "/admin/seats",
      label: "Asientos",
      show: canManageSeats(role),
    },
    {
      href: "/admin/payments",
      label: "Pagos",
      show: canManagePayments(role),
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Editorial top bar */}
      <div className="bg-navy-deep text-cream border-b border-navy-soft">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link
              href="/admin/dashboard"
              className="serif-display text-[24px] lg:text-[28px] text-cream leading-none"
            >
              Administración
            </Link>
            <div className="hairline hidden md:inline-block" />
            <div className="hidden md:block text-[10px] tracking-[0.3em] uppercase text-cream/50 font-semibold">
              Midrash Natán Torá
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-[10px] tracking-[0.22em] uppercase font-semibold text-gold-light/80">
              {role ? ROLE_LABEL[role] : ""}
            </span>
            <Link
              href="/"
              className="text-[11px] tracking-[0.22em] uppercase font-semibold text-cream/60 hover:text-gold-light transition-colors duration-base ease-out-quart"
            >
              ← Volver al sitio
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="text-[11px] tracking-[0.22em] uppercase font-semibold text-cream/60 hover:text-gold-light transition-colors duration-base ease-out-quart"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="eyebrow text-gold mb-5">Secciones</div>
          <nav className="flex flex-col gap-1">
            {nav
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[13px] tracking-[0.06em] py-2.5 px-1 text-ink-soft hover:text-navy border-b border-line-soft hover:border-gold transition-colors duration-base ease-out-quart flex items-center justify-between gap-2"
                >
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="text-[10px] tracking-[0.05em] font-bold bg-gold text-navy-deep px-1.5 py-0.5 rounded-sm">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
