"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  tokenId: string;
  action: "approve" | "reject";
  userName: string;
}

export default function ApprovalForm({ tokenId, action, userName }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; action: "approve" | "reject" }
    | { ok: false; error: string }
    | null
  >(null);

  async function onConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/approve/${tokenId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: data.error || "Error" });
      } else {
        setResult({ ok: true, action: data.action });
      }
    } catch (e) {
      setResult({ ok: false, error: "Error de red. Intenta de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="bg-green-50 border border-green-200 p-6">
        <div className="text-[10px] tracking-[0.22em] uppercase text-green-800 font-bold mb-2">
          ✓ Hecho
        </div>
        <div className="text-[16px] text-green-900 font-medium mb-4">
          {result.action === "approve"
            ? `${userName} fue aprobado. Ya puede entrar al sitio.`
            : `${userName} fue rechazado.`}
        </div>
        <Link
          href="/admin/members"
          className="text-[11px] tracking-[0.22em] uppercase font-bold text-green-900 border-b border-green-700 pb-0.5"
        >
          Ver todos los miembros →
        </Link>
      </div>
    );
  }

  if (result && !result.ok) {
    return (
      <div className="bg-red-50 border border-red-200 p-6 mb-6">
        <div className="text-[10px] tracking-[0.22em] uppercase text-red-800 font-bold mb-2">
          Error
        </div>
        <div className="text-[15px] text-red-900">{result.error}</div>
        <Link
          href="/admin/members"
          className="mt-4 inline-block text-[11px] tracking-[0.22em] uppercase font-bold text-red-900 border-b border-red-700 pb-0.5"
        >
          Ir al panel →
        </Link>
      </div>
    );
  }

  const isApprove = action === "approve";
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onConfirm}
        disabled={loading}
        className={
          "btn " +
          (isApprove ? "btn-dark" : "btn-primary") +
          " disabled:opacity-50"
        }
      >
        {loading
          ? "Procesando…"
          : isApprove
            ? "Confirmar aprobación →"
            : "Confirmar rechazo →"}
      </button>
      <Link
        href="/admin/members"
        className="text-[11px] tracking-[0.22em] uppercase font-bold text-ink-soft border border-line px-6 py-3.5 hover:border-ink hover:text-ink transition-colors"
      >
        Cancelar
      </Link>
    </div>
  );
}
