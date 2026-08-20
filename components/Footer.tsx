import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdminPanel, type Role } from "@/lib/permissions";

export default async function SiteFooter() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const hasAdmin = canAccessAdminPanel(user?.role as Role | null | undefined);

  return (
    <footer className="bg-navy-deep text-cream/65 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 texture-paper opacity-25 pointer-events-none"
      />

      {/* ============ Editorial top — poetic statement ============ */}
      <div className="relative border-b border-navy-soft/60 px-6 lg:px-12 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="eyebrow eyebrow-line text-gold-light mb-6">
              Una casa de Torá
            </div>
            <p className="font-serif text-[28px] lg:text-[36px] leading-[1.25] text-cream/90 font-light max-w-2xl">
              <em>&quot;Para que toda nuestra casa, y la casa de cada uno,</em>{" "}
              esté llena de Torá.&quot;
            </p>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            {isLoggedIn ? (
              <>
                <p className="text-[13px] text-cream/55 leading-[1.75] mb-6 max-w-sm">
                  Tu sesión está activa. Continúa explorando las clases, horarios
                  y actividades del Midrash.
                </p>
                <Link
                  href={hasAdmin ? "/admin/dashboard" : "/clases"}
                  className="inline-block text-[11px] tracking-[0.22em] uppercase font-bold text-gold-light border-b border-gold pb-1 hover:text-cream transition-colors duration-base ease-out-quart"
                >
                  {hasAdmin ? "Abrir administración →" : "Explorar clases →"}
                </Link>
              </>
            ) : (
              <>
                <p className="text-[13px] text-cream/55 leading-[1.75] mb-6 max-w-sm">
                  Si quieres formar parte del Midrash, solicita tu registro y un
                  administrador revisará tu solicitud.
                </p>
                <Link
                  href="/auth/registro"
                  className="inline-block text-[11px] tracking-[0.22em] uppercase font-bold text-gold-light border-b border-gold pb-1 hover:text-cream transition-colors duration-base ease-out-quart"
                >
                  Hazte miembro →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============ Main nav grid ============ */}
      <div className="relative px-6 lg:px-12 pt-16 pb-10">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-navy-soft/60">
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="block mb-6"
              aria-label="Midrash Natán Torá"
            >
              <Image
                src="/logo.png"
                style={{
                  filter:
                    "brightness(0) invert(70%) sepia(50%) saturate(450%) hue-rotate(8deg) brightness(95%)",
                }}
                alt="Midrash Natán Torá"
                width={1196}
                height={936}
                className="h-24 w-auto"
              />
            </Link>
            <p className="text-[13px] leading-[1.75] max-w-xs font-normal">
              Centro de estudio y oración de la comunidad judía sefardí en
              Polanco, Ciudad de México. Minhag Halabi de Aram Tzobá.
            </p>
          </div>

          <div>
            <h5 className="text-[10px] text-gold-light tracking-[0.3em] uppercase font-bold mb-5">
              Comunidad
            </h5>
            <ul className="space-y-3 text-[13px] tracking-[0.02em]">
              <li>
                <Link
                  href="/quienes-somos"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  Quiénes somos
                </Link>
              </li>
              <li>
                <Link
                  href="/horarios"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  Horarios de rezo
                </Link>
              </li>
              <li>
                <Link
                  href="/clases"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  Clases de Torá
                </Link>
              </li>
              <li>
                <Link
                  href="/eventos"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  Eventos
                </Link>
              </li>
              <li>
                <Link
                  href="/galeria"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  Galería
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="text-[10px] text-gold-light tracking-[0.3em] uppercase font-bold mb-5">
              Apoyo
            </h5>
            <ul className="space-y-3 text-[13px] tracking-[0.02em]">
              <li>
                <Link
                  href="/donativos"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  Donativos
                </Link>
              </li>
              {!isLoggedIn && (
                <li>
                  <Link
                    href="/auth/registro"
                    className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                  >
                    Hazte miembro
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h5 className="text-[10px] text-gold-light tracking-[0.3em] uppercase font-bold mb-5">
              Contacto
            </h5>
            <ul className="space-y-3 text-[13px] tracking-[0.02em]">
              <li>
                <a
                  href="mailto:info@natantora.com"
                  className="hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  info@natantora.com
                </a>
              </li>
              <li className="text-cream/50">Plaza Polanco</li>
              <li className="text-cream/50">Ciudad de México</li>
              <li className="text-[10px] text-cream/35 mt-4 font-medium uppercase tracking-[0.22em] leading-[1.6]">
                Dirección completa visible
                <br />
                para miembros registrados
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto max-w-7xl pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] tracking-[0.3em] uppercase text-cream/40 font-semibold">
          <div>© 2026 Midrash Natán Torá · Plaza Polanco</div>
          <div className="flex items-center gap-2 text-cream/30">
            <span className="hairline" />
            <span>Hecho con cuidado en CDMX</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
