import Link from "next/link";
import { getTokenInfo } from "@/lib/approval-tokens";
import ApprovalForm from "./ApprovalForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ApprovePage({ params }: PageProps) {
  const { token } = await params;
  const info = await getTokenInfo(token);

  // Token inválido
  if (!info) {
    return (
      <Shell>
        <div className="eyebrow eyebrow-line text-gold mb-5">
          Enlace inválido
        </div>
        <h1 className="serif-display text-navy mb-6">
          Este enlace <em>no existe.</em>
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed mb-8">
          Es posible que haya expirado, ya se haya usado, o el enlace esté
          incompleto. Puedes ir al panel y aprobar manualmente.
        </p>
        <Link href="/admin/members" className="btn btn-dark">
          Ir al panel
        </Link>
      </Shell>
    );
  }

  // Token usado
  if (info.usedAt) {
    return (
      <Shell>
        <div className="eyebrow eyebrow-line text-gold mb-5">Ya procesado</div>
        <h1 className="serif-display text-navy mb-6">
          Este enlace <em>ya fue usado.</em>
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed mb-8">
          La solicitud de {info.user?.full_name || "este usuario"} ya fue
          atendida el {new Date(info.usedAt).toLocaleString("es-MX")}. Si
          necesitas revisarla o revertirla, ve al panel.
        </p>
        <Link href="/admin/members" className="btn btn-dark">
          Ver miembros
        </Link>
      </Shell>
    );
  }

  // Token expirado
  if (new Date(info.expiresAt).getTime() < Date.now()) {
    return (
      <Shell>
        <div className="eyebrow eyebrow-line text-gold mb-5">Expirado</div>
        <h1 className="serif-display text-navy mb-6">
          Este enlace <em>expiró.</em>
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed mb-8">
          Los enlaces de aprobación duran 7 días. Puedes aprobar manualmente
          en el panel.
        </p>
        <Link href="/admin/members" className="btn btn-dark">
          Ir al panel
        </Link>
      </Shell>
    );
  }

  // Si el user ya no está pending, informar
  if (info.user?.status && info.user.status !== "pending") {
    return (
      <Shell>
        <div className="eyebrow eyebrow-line text-gold mb-5">
          Estado ya cambió
        </div>
        <h1 className="serif-display text-navy mb-6">
          Este miembro ya está <em>{info.user.status === "approved" ? "aprobado" : "rechazado"}.</em>
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed mb-8">
          Otro administrador ya procesó esta solicitud o el estado fue cambiado
          manualmente.
        </p>
        <Link href="/admin/members" className="btn btn-dark">
          Ver miembros
        </Link>
      </Shell>
    );
  }

  // Token válido — mostrar confirmación
  const isApprove = info.action === "approve";
  return (
    <Shell>
      <div className="eyebrow eyebrow-line text-gold mb-5">
        Confirma tu acción
      </div>
      <h1 className="serif-display text-navy mb-3">
        {isApprove ? (
          <>
            Aprobar a <em>{info.user?.full_name || "este miembro"}</em>
          </>
        ) : (
          <>
            Rechazar a <em>{info.user?.full_name || "este miembro"}</em>
          </>
        )}
      </h1>
      <p className="text-[14px] text-ink-soft mb-10">
        Revisa los datos antes de confirmar. Esta acción se aplica de inmediato.
      </p>

      <dl className="border-y border-line divide-y divide-line-soft mb-10">
        <DataRow label="Nombre" value={info.user?.full_name || "—"} />
        <DataRow label="Email" value={info.user?.email || "—"} />
        <DataRow label="Teléfono" value={info.user?.phone || "—"} />
        <DataRow
          label="Solicitó acceso"
          value={
            info.user?.created_at
              ? new Date(info.user.created_at).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
        />
      </dl>

      <ApprovalForm
        tokenId={token}
        action={info.action}
        userName={info.user?.full_name || "este miembro"}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full bg-cream-light border border-line p-8 lg:p-12 relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 texture-paper opacity-40 pointer-events-none"
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4 grid grid-cols-[110px_1fr] gap-4 items-baseline">
      <dt className="text-[10px] tracking-[0.22em] uppercase text-ink-muted font-bold">
        {label}
      </dt>
      <dd className="text-[15px] text-navy font-medium">{value}</dd>
    </div>
  );
}
