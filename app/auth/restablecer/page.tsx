"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "El enlace no es válido.");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex min-h-[70vh] items-center justify-center bg-cream px-6 py-20">
      <div className="w-full max-w-md border border-line bg-cream-light p-8 lg:p-10">
        {success ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-6 h-12 w-12 text-gold" />
            <div className="eyebrow eyebrow-line mb-6 inline-block text-gold">Contraseña actualizada</div>
            <h1 className="display-md mb-4 text-navy">Tu cuenta está lista</h1>
            <p className="mb-8 text-[14px] leading-[1.8] text-ink-soft">Ya puedes iniciar sesión con tu correo y la contraseña nueva.</p>
            <Link href="/auth/login" className="inline-block bg-navy-deep px-7 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-cream hover:bg-gold hover:text-navy-deep">Iniciar sesión</Link>
          </div>
        ) : (
          <>
            <div className="eyebrow eyebrow-line mb-6 text-gold">Seguridad de tu cuenta</div>
            <h1 className="display-md mb-3 text-navy">Contraseña <span className="accent">nueva</span></h1>
            <p className="mb-8 text-[14px] leading-[1.7] text-ink-soft">Debe tener al menos 8 caracteres. Al guardarla se cerrarán las sesiones anteriores.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-ink">Nueva contraseña</label>
                <input required minLength={8} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full border border-line bg-white px-4 py-3 text-[15px] text-navy outline-none focus:border-gold" />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-ink">Confirmar contraseña</label>
                <input required minLength={8} maxLength={128} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="w-full border border-line bg-white px-4 py-3 text-[15px] text-navy outline-none focus:border-gold" />
              </div>
              {error ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div> : null}
              <button type="submit" disabled={loading || !token} className="w-full bg-navy-deep py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-navy-deep disabled:opacity-50">{loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Guardar contraseña"}</button>
            </form>
            <p className="mt-8 text-center text-[13px] text-ink-soft"><Link href="/auth/recuperar" className="font-bold text-gold hover:underline">Solicitar otro enlace</Link></p>
          </>
        )}
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-[70vh]" />}><ResetPasswordForm /></Suspense>;
}
