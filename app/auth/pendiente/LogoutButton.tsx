"use client";

export default function LogoutButton() {
  async function logout() {
    const response = await fetch("/api/admin/logout", {
      method: "POST",
      headers: { "X-Logout-Mode": "fetch" },
      cache: "no-store",
    });
    if (!response.ok) return;
    window.location.assign("/");
  }

  return (
    <button
      onClick={logout}
      className="text-[11px] tracking-[0.18em] uppercase font-bold text-ink-muted hover:text-navy transition-colors border-b border-line/40 pb-1"
    >
      Cerrar sesión
    </button>
  );
}
