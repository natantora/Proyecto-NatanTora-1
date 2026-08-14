"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
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
