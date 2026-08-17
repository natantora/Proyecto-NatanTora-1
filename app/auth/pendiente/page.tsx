import { createClient } from "@/lib/data/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Solicitud en revisión — Midrash Natán Torá",
};

export default async function PendientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "approved") {
    redirect("/");
  }

  if (profile?.status === "rejected") {
    return (
      <section className="min-h-[70vh] flex items-center justify-center px-6 py-20 bg-cream">
        <div className="max-w-md text-center">
          <div className="eyebrow eyebrow-line text-gold mb-6 inline-block">
            Solicitud no aprobada
          </div>
          <h1 className="display-md text-navy mb-4">
            Tu solicitud no pudo ser aprobada
          </h1>
          <p className="text-[15px] text-ink-soft leading-[1.8] mb-8">
            Si crees que es un error, por favor contacta con el Midrash a{" "}
            <a
              href="mailto:info@natantora.com"
              className="text-gold hover:underline"
            >
              info@natantora.com
            </a>
          </p>
          <LogoutButton />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[70vh] flex items-center justify-center px-6 py-20 bg-cream">
      <div className="max-w-md text-center">
        <div className="eyebrow eyebrow-line text-gold mb-6 inline-block">
          Solicitud en revisión
        </div>
        <h1 className="display-md text-navy mb-4">
          Estamos revisando tu solicitud
        </h1>
        <p className="text-[15px] text-ink-soft leading-[1.8] mb-6">
          {profile?.full_name ? `Hola, ${profile.full_name}.` : "Hola."} Un
          administrador del Midrash está revisando tu registro y te notificará
          por correo cuando esté aprobado. Esto suele tomar 24-48 horas.
        </p>
        <p className="text-[13px] text-ink-muted mb-10 leading-[1.7]">
          Mantenemos este proceso de aprobación por la seguridad del lugar y de
          la comunidad que asiste.
          <br />
          <br />
          Dudas:{" "}
          <a
            href="mailto:info@natantora.com"
            className="text-gold hover:underline"
          >
            info@natantora.com
          </a>
        </p>
        <LogoutButton />
      </div>
    </section>
  );
}
