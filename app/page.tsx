import Link from "next/link";
import ShabbatStrip from "@/components/ShabatWidget";
import DailyZemanim from "@/components/DailyZemanim";
import { getCurrentUser } from "@/lib/auth";

const KAPAROT_EVENT_URL = "/eventos/ffecacbe-be70-4b64-944f-f386acb40ebb";

export default async function Home() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <>
      <section className="relative bg-navy-deep text-cream overflow-hidden">
        <div
          aria-hidden="true"
          className="home-hero-photo absolute inset-0 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="home-hero-overlay absolute inset-0 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)",
            backgroundSize: "96px 96px",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 texture-paper opacity-40 mix-blend-overlay pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto min-h-[760px] lg:min-h-[860px] px-6 lg:px-12 py-20 lg:py-28 flex items-end lg:items-center">
          <div className="max-w-3xl fade-in pb-6 lg:pb-0">
            <div className="w-16 h-px bg-gold-light mb-7 lg:mb-9" />
            <h1 className="font-serif text-[52px] sm:text-[66px] lg:text-[88px] leading-[0.95] tracking-[-0.035em] text-cream font-normal">
              Midrash Natán Torá
            </h1>
            <p className="mt-6 lg:mt-8 font-serif italic text-[34px] sm:text-[42px] lg:text-[54px] leading-tight text-gold-light">
              En el corazón de Polanco
            </p>
            <p className="mt-5 lg:mt-6 text-[15px] sm:text-[17px] lg:text-[19px] tracking-[0.16em] uppercase text-cream/85 font-medium">
              Un lugar diseñado para ti.
            </p>

            <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row sm:flex-wrap gap-4">
              {isLoggedIn && (
                <Link href="/eventos" className="btn btn-primary text-center">
                  Reserva tu lugar
                </Link>
              )}
              <Link
                href={isLoggedIn ? "/clases" : "/auth/registro"}
                className={`btn text-center ${isLoggedIn ? "btn-ghost" : "btn-primary"}`}
              >
                {isLoggedIn ? "Explorar clases" : "Únete al Midrash"}
              </Link>
              <Link href="/quienes-somos" className="btn btn-ghost text-center">
                Conoce el Midrash
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gold/30 bg-cream px-6 py-16 lg:px-12 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-8 border border-gold/35 bg-cream-light px-7 py-10 sm:px-10 lg:grid-cols-[1fr_auto] lg:px-14 lg:py-12">
          <div>
            <div className="eyebrow eyebrow-line mb-5 text-gold">Kaparot 5787</div>
            <h2 className="font-serif text-4xl font-normal leading-tight text-navy sm:text-5xl">
              Haz Kaparot con nosotros
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              Registra a las personas de tu familia y realiza el pago en línea de forma segura.
            </p>
          </div>
          <Link href={KAPAROT_EVENT_URL} className="btn btn-primary w-full justify-center text-center sm:w-auto">
            Hacer Kaparot
          </Link>
        </div>
      </section>

      {/* Zemanim del día — público, sin login */}
      <DailyZemanim />

      {/* Shabat strip */}
      <ShabbatStrip />

      <section className="px-6 lg:px-12 py-24 lg:py-36 bg-cream">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mb-16 lg:mb-24 reveal">
            <div className="lg:col-span-5">
              <div className="eyebrow eyebrow-line text-gold mb-6">
                Vida del Midrash
              </div>
              <h2 className="serif-display text-navy">
                Estudio y comunidad,
                <br />
                <em>todos los días.</em>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-2">
              <p className="text-[16px] text-ink-soft leading-[1.8] font-normal max-w-prose">
                Tres caminos para vivir el Midrash: aprende con nuestros
                maestros, súmate a la vida comunitaria, o apoya para que sigamos
                creciendo. {isLoggedIn
                  ? "Tu cuenta ya tiene acceso a los horarios, las clases y los eventos."
                  : "Para ver horarios de rezos del Midrash, clases y eventos, regístrate y un administrador aprobará tu acceso."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line">
            <FeatureCard
              num="01"
              title="Clases de Torá"
              desc="Halajá, parashá, guemará y mussar. Maestros con tradición de Alepo, ahora en CDMX."
              href="/clases"
              cta="Explorar clases"
              delayClass="reveal reveal-delay-1"
            />
            <FeatureCard
              num="02"
              title="Eventos comunitarios"
              desc="Cenas, brit milá, bar mitzvá, fiestas mayores. Inscripciones abiertas."
              href="/eventos"
              cta="Ver agenda"
              delayClass="reveal reveal-delay-2"
            />
            <FeatureCard
              num="03"
              title="Apoya el Midrash"
              desc="Tu donativo sostiene clases, becas y el espacio físico. Mensualidades y donaciones específicas."
              href="/donativos"
              cta="Donar"
              delayClass="reveal reveal-delay-3"
            />
          </div>
        </div>
      </section>

      <section className="bg-cream-dark px-6 lg:px-12 py-24 lg:py-36 relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 texture-paper opacity-50 pointer-events-none"
        />
        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-24">
          <div className="reveal">
            <div className="eyebrow eyebrow-line text-gold mb-6">
              Quiénes somos
            </div>
            <h2 className="serif-display text-navy mb-8">
              Una casa con raíces de Alepo,
              <br />
              <em>sembrada en Polanco.</em>
            </h2>
            <div className="hidden lg:block">
              <div className="hairline mb-5" />
              <p className="text-[12px] tracking-[0.2em] uppercase text-ink-muted font-semibold">
                Minhag Halabi · Aram Tzobá
              </p>
            </div>
          </div>

          <div className="reveal reveal-delay-1">
            <p className="text-[17px] text-ink leading-[1.85] mb-6 font-normal dropcap">
              El Midrash Natán Torá nació del deseo de continuar, en la Ciudad
              de México, la tradición espiritual de la comunidad judía de Alepo
              (Aram Tzobá): el estudio profundo, el rezo cantado y la calidez
              del Shulján Aruj vivido en familia.
            </p>
            <p className="text-[16px] text-ink-soft leading-[1.85] mb-10 font-normal max-w-prose">
              Somos un centro de estudio y oración con clases diarias, minián
              completo en las tres tefilot, y un calendario de eventos
              comunitarios alrededor de Shabat, las fiestas mayores y los ciclos
              de la vida.
            </p>

            <blockquote className="pullquote">
              &quot;Cada palabra de Torá estudiada en esta casa es una piedra más en
              el camino que conecta Alepo con el porvenir.&quot;
            </blockquote>

            <div className="mt-10">
              <Link href="/quienes-somos" className="link-gold">
                Conoce nuestra historia →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureCard({
  num,
  title,
  desc,
  href,
  cta,
  delayClass,
}: {
  num: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  delayClass: string;
}) {
  return (
    <div
      className={`bg-cream-light p-10 lg:p-12 transition-colors duration-base ease-out-quart hover:bg-white group ${delayClass}`}
    >
      <div className="flex items-baseline gap-4 mb-8">
        <span className="font-serif text-[44px] leading-none text-gold-deep font-light">
          {num}
        </span>
        <span className="hairline" />
      </div>
      <h3 className="text-[17px] font-bold tracking-[0.06em] uppercase text-navy mb-4 leading-tight">
        {title}
      </h3>
      <p className="text-[14px] text-ink-soft leading-[1.7] mb-8 font-normal">
        {desc}
      </p>
      <Link href={href} className="link-gold">
        {cta} →
      </Link>
    </div>
  );
}
