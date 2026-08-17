"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
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
