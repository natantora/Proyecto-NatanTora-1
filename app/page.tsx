import Link from "next/link";
import ShabbatStrip from "@/components/ShabatWidget";
import DailyZemanim from "@/components/DailyZemanim";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <>
      <section className="relative bg-navy-deep text-cream overflow-hidden">
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

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-24 lg:pt-32 pb-20 lg:pb-28">
          <div className="flex items-center justify-between mb-16 lg:mb-24 fade-in">
            <div className="eyebrow eyebrow-line text-gold-light">
              Plaza Polanco · Ciudad de México
            </div>
            <div className="hidden md:block text-[10px] tracking-[0.3em] uppercase text-cream/40 font-semibold">
              Est. 5786
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
            <div className="lg:col-span-9 fade-in">
              <h1 className="serif-hero text-cream">
                Casa de estudio,
                <br />
                de oración
                <br />
                <em className="accent-light">y de comunidad.</em>
              </h1>
            </div>

            <div className="lg:col-span-3 lg:pb-4 fade-in">
              <div className="hairline mb-5" />
              <p className="text-[14px] leading-[1.65] text-cream/70 font-normal">
                Centro espiritual sefardí en el corazón de Polanco. Clases
                diarias de Torá, rezos y vida comunitaria bajo el minhag Halabi
                de Aram Tzobá.
              </p>
            </div>
          </div>

          <div className="mt-14 lg:mt-20 flex flex-wrap gap-4 fade-in">
            <Link href={isLoggedIn ? "/clases" : "/auth/registro"} className="btn btn-primary">
              {isLoggedIn ? "Explorar clases" : "Únete al Midrash"}
            </Link>
            <Link href="/quienes-somos" className="btn btn-ghost">
              Conoce el Midrash
            </Link>
          </div>

          <div className="mt-20 lg:mt-28 pt-10 border-t border-navy-soft/60 grid grid-cols-2 lg:grid-cols-4 gap-8 text-[11px] tracking-[0.18em] uppercase text-cream/55 font-semibold">
            <div>
              <div className="text-cream/35 mb-1.5">Tradición</div>
              <div>Minhag Halabi</div>
            </div>
            <div>
              <div className="text-cream/35 mb-1.5">Referencia</div>
              <div>Shulján HaMélej</div>
            </div>
            <div>
              <div className="text-cream/35 mb-1.5">Origen</div>
              <div>Aram Tzobá</div>
            </div>
            <div>
              <div className="text-cream/35 mb-1.5">Hogar</div>
              <div>Polanco · CDMX</div>
            </div>
          </div>
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
