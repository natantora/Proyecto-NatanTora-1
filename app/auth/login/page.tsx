"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = params.get("next") ?? params.get("from") ?? "/";
  const oauthError = params.get("oauth_error");
  const oauthMessage = oauthError?.endsWith("_not_configured")
    ? "Este proveedor todavía no tiene sus credenciales configuradas."
    : oauthError
      ? "No se pudo completar el acceso. Inténtalo nuevamente."
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Credenciales incorrectas.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  function onOAuth(provider: "google" | "apple") {
    setOauthLoading(provider);
    setError(null);
    router.push(`/api/auth/oauth/${provider}?next=${encodeURIComponent(next)}`);
  }

  return (
    <section className="min-h-[70vh] flex items-center justify-center px-6 py-20 bg-cream">
      <div className="w-full max-w-md">
        <div className="bg-cream-light border border-line p-8 lg:p-10">
          <div className="eyebrow eyebrow-line text-gold mb-6">Bienvenido</div>
          <h1 className="display-md text-navy mb-3">
            Entra a tu <span className="accent">cuenta</span>
          </h1>
          <p className="text-[14px] text-ink-soft mb-8 leading-[1.7]">
            Acceso para miembros del Midrash Natán Torá.
          </p>

          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => onOAuth("google")}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 border border-line bg-white hover:border-gold transition-colors py-3 text-[14px] font-medium text-navy disabled:opacity-50"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onOAuth("apple")}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 border border-line bg-white hover:border-gold transition-colors py-3 text-[14px] font-medium text-navy disabled:opacity-50"
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Continuar con Apple
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-ink-muted">
              o con email
            </span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-ink uppercase tracking-[0.2em] mb-2">
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-line focus:border-gold outline-none text-[15px] text-navy"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink uppercase tracking-[0.2em] mb-2">
                Contraseña
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-line focus:border-gold outline-none text-[15px] text-navy"
                autoComplete="current-password"
              />
            </div>
            {(error || oauthMessage) && (
              <div className="bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-800">
                {error || oauthMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !!oauthLoading}
              className="w-full bg-navy-deep text-cream py-3 text-[12px] tracking-[0.2em] uppercase font-bold hover:bg-gold hover:text-navy-deep transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-ink-soft">
            ¿No tienes cuenta?{" "}
            <Link
              href="/auth/registro"
              className="text-gold font-bold hover:underline"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <LoginForm />
    </Suspense>
  );
}
