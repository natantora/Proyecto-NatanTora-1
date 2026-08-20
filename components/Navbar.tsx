'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const links = [
  { href: '/horarios', label: 'Horarios' },
  { href: '/clases', label: 'Clases' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/donativos', label: 'Donativos' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);

    fetch('/api/auth/me').then((res) => res.json()).then((data) => {
      if (data.user) { setUser(data.user); setProfile(data.user); }
    }).catch(() => undefined);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setUser(null);
    setProfile(null);
    window.location.href = '/';
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? 'shadow-lg' : ''}`}
      style={{ background: 'rgba(10,22,40,.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,168,76,.15)' }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-[68px]">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Image src="/logo.png" alt="Logo" width={48} height={48} className="brightness-[2.5]" />
          <span className="text-gold font-bold tracking-wide font-heading text-lg hidden sm:block">Natán Torá</span>
        </Link>

        <ul className={`${menuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-1 absolute md:static top-[68px] left-0 right-0 md:top-auto p-5 md:p-0`}
          style={{ background: menuOpen ? 'rgba(10,22,40,.98)' : 'transparent' }}>
          {links.map(l => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setMenuOpen(false)}
                className="text-white/70 text-xs font-medium px-3.5 py-2 rounded-md hover:text-gold hover:bg-gold/10 transition-all block tracking-wide">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-gold text-xs font-semibold hidden sm:block">{profile?.full_name || user.email}</span>
              {['rabino','editor','admin','owner'].includes(profile?.role ?? '') && (
                <Link href="/admin" className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-gold text-navy hover:bg-gold-light transition-all">⚙️ Admin</Link>
              )}
              <button onClick={handleLogout} className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-gold/30 text-gold hover:border-gold transition-all">Salir</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-gold/30 text-gold hover:border-gold transition-all">Entrar</Link>
              <Link href="/auth/registro" className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-gold text-navy hover:bg-gold-light transition-all">Registrarse</Link>
            </>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gold text-2xl bg-transparent border-none cursor-pointer">☰</button>
        </div>
      </div>
    </nav>
  );
}
