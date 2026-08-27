"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo enviar la solicitud.");
      setMessage(data.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex min-h-[70vh] items-center justify-center bg-cream px-6 py-20">
      <div className="w-full max-w-md border border-line bg-cream-light p-8 lg:p-10">
        {message ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-6 h-12 w-12 text-gold" />
            <div className="eyebrow eyebrow-line mb-6 inline-block text-gold">Revisa tu correo</div>
            <h1 className="display-md mb-4 text-navy">Solicitud enviada</h1>
            <p className="mb-8 text-[14px] leading-[1.8] text-ink-soft">{message} Revisa también la carpeta de correo no deseado.</p>
            <Link href="/auth/login" className="text-[11px] font-bold uppercase tracking-[0.18em] text-navy hover:text-gold">Volver a iniciar sesión →</Link>
          </div>
        ) : (
          <>
            <div className="eyebrow eyebrow-line mb-6 text-gold">Recuperar acceso</div>
            <h1 className="display-md mb-3 text-navy">Cambia tu <span className="accent">contraseña</span></h1>
            <p className="mb-8 text-[14px] leading-[1.7] text-ink-soft">Escribe el correo de tu cuenta. Te enviaremos un enlace seguro que vence en 30 minutos.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-ink">Email</label>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="w-full border border-line bg-white px-4 py-3 text-[15px] text-navy outline-none focus:border-gold" />
              </div>
              {error ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div> : null}
              <button type="submit" disabled={loading} className="w-full bg-navy-deep py-3 text-[12px] font-bold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-navy-deep disabled:opacity-50">{loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Enviar enlace"}</button>
            </form>
            <p className="mt-8 text-center text-[13px] text-ink-soft"><Link href="/auth/login" className="font-bold text-gold hover:underline">Volver a iniciar sesión</Link></p>
          </>
        )}
      </div>
    </section>
  );
}
