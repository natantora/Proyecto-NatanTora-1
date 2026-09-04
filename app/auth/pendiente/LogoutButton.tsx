"use client";

export default function LogoutButton() {
  async function logout() {
    const response = await fetch("/api/admin/logout", { method: "POST" });
    if (!response.ok) return;
    window.location.replace("/");
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
