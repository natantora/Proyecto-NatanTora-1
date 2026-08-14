"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/quienes-somos", label: "Quiénes somos" },
  { href: "/horarios", label: "Horarios" },
  { href: "/clases", label: "Clases" },
  { href: "/eventos", label: "Eventos" },
  { href: "/galeria", label: "Galería" },
  { href: "/contacto", label: "Contacto" },
];

type Props = { isLoggedIn: boolean; approved: boolean; isAdmin?: boolean };

export default function HeaderClient({ isLoggedIn, approved, isAdmin }: Props) {
  const [open, setOpen] = useState(false);

  const showNav = approved;
  const showDonar = approved;
  const showLoginRegister = !isLoggedIn;
  const showPendiente = isLoggedIn && !approved;

  return (
    <header className="sticky top-0 z-50 bg-navy-deep/95 backdrop-blur-md border-b border-navy-soft/80 supports-[backdrop-filter]:bg-navy-deep/85">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-3 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="block shrink-0 transition-opacity duration-base ease-out-quart hover:opacity-80"
          aria-label="Midrash Natán Torá — Inicio"
        >
          <Image
            src="/logo.png"
            style={{
              filter:
                "brightness(0) invert(70%) sepia(50%) saturate(450%) hue-rotate(8deg) brightness(95%)",
            }}
            alt="Midrash Natán Torá · Plaza Polanco"
            width={1196}
            height={936}
            priority
            className="h-14 w-auto lg:h-[68px]"
          />
        </Link>

        {showNav && (
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[11px] font-semibold tracking-[0.22em] uppercase text-cream/80 hover:text-gold-light transition-colors duration-base ease-out-quart"
              >
                {l.label}
              </Link>
            ))}
            {showDonar && (
              <Link
                href="/donativos"
                className="bg-gold text-navy-deep px-5 py-2.5 text-[11px] tracking-[0.22em] uppercase font-bold hover:bg-gold-light transition-colors duration-base ease-out-quart"
              >
                Donar
              </Link>
            )}
          </nav>
        )}

        <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-navy-soft/60">
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className="text-[11px] tracking-[0.22em] uppercase font-bold text-gold border border-gold px-3 py-1.5 hover:bg-gold hover:text-navy-deep transition-colors duration-base ease-out-quart"
            >
              Admin
            </Link>
          )}
          {showLoginRegister && (
            <>
              <Link
                href="/auth/login"
                className="text-[11px] tracking-[0.18em] uppercase font-semibold text-cream/60 hover:text-gold-light transition-colors duration-base ease-out-quart"
              >
                Entrar
              </Link>
              <Link
                href="/auth/registro"
                className="text-[11px] tracking-[0.18em] uppercase font-semibold text-cream/60 hover:text-gold-light transition-colors duration-base ease-out-quart"
              >
                Registrarse
              </Link>
            </>
          )}
          {showPendiente && (
            <Link
              href="/auth/pendiente"
              className="text-[11px] tracking-[0.18em] uppercase font-semibold text-gold-light hover:text-gold transition-colors duration-base ease-out-quart"
            >
              Mi solicitud
            </Link>
          )}
        </div>

        <button
          aria-label="Menú"
          aria-expanded={open}
          className="lg:hidden text-cream text-2xl transition-transform duration-base ease-out-quart hover:scale-110"
          onClick={() => setOpen(!open)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-navy-soft/60 bg-navy-deep">
          <nav className="px-6 py-4 flex flex-col gap-0.5">
            {showNav &&
              navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="py-3.5 text-[13px] tracking-[0.18em] uppercase font-semibold text-cream/85 border-b border-navy-soft/40 hover:text-gold-light transition-colors duration-base ease-out-quart"
                >
                  {l.label}
                </Link>
              ))}
            {showDonar && (
              <Link
                href="/donativos"
                onClick={() => setOpen(false)}
                className="mt-4 bg-gold text-navy-deep px-5 py-3.5 text-[11px] tracking-[0.22em] uppercase font-bold text-center hover:bg-gold-light transition-colors duration-base ease-out-quart"
              >
                Donar
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                className="mt-2 border border-gold text-gold px-5 py-3.5 text-[11px] tracking-[0.22em] uppercase font-bold text-center hover:bg-gold hover:text-navy-deep transition-colors duration-base ease-out-quart"
              >
                Panel admin
              </Link>
            )}
            <div className="flex gap-5 mt-4 pt-4 border-t border-navy-soft/40">
              {showLoginRegister && (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setOpen(false)}
                    className="text-[12px] tracking-[0.18em] uppercase font-semibold text-cream/65 hover:text-gold-light transition-colors duration-base ease-out-quart"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/auth/registro"
                    onClick={() => setOpen(false)}
                    className="text-[12px] tracking-[0.18em] uppercase font-semibold text-cream/65 hover:text-gold-light transition-colors duration-base ease-out-quart"
                  >
                    Registrarse
                  </Link>
                </>
              )}
              {showPendiente && (
                <Link
                  href="/auth/pendiente"
                  onClick={() => setOpen(false)}
                  className="text-[12px] tracking-[0.18em] uppercase font-semibold text-gold-light hover:text-gold transition-colors duration-base ease-out-quart"
                >
                  Mi solicitud
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
