export const metadata = {
  title: 'Quiénes Somos — Midrash Natán Torá',
  description: 'El Midrash Natán Torá en Plaza Polanco, CDMX. Comunidad sefardí de tradición Halabi, dedicada al estudio de la Torá.'
}

export const dynamic = 'force-dynamic'

export default function QuienesSomos() {
  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Quiénes Somos</div>
          <h1 className="display-lg">Una comunidad de <span className="accent-light">estudio y oración.</span></h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl leading-[1.7]">
            El Midrash Natán Torá es un centro de estudio de Torá y casa de oración en Plaza Polanco, Ciudad de México, dedicado a preservar la tradición sefardí Halabi de Aram Tzobá según las halajot del Shulján HaMélej.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-24 bg-cream">
        <div className="max-w-4xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold mb-6">Nuestra Historia</div>
          <h2 className="display-lg text-navy mb-8">Raíces en <span className="accent">Aram Tzobá</span></h2>
          <div className="prose-elegant space-y-5 text-[16px] text-ink leading-[1.85]">
            <p>
              El Midrash Natán Torá lleva el nombre de un querido miembro de nuestra comunidad, cuya devoción al estudio de la Torá inspiró la creación de este espacio.
            </p>
            <p>
              Nuestra comunidad pertenece a la tradición de los judíos de Aleppo (Aram Tzobá, Siria), conocidos por su rigurosa práctica halájica, su música litúrgica única y la transmisión generación tras generación de las costumbres de nuestros padres.
            </p>
            <p>
              En el corazón de Plaza Polanco, el Midrash es un hogar para quienes buscan profundizar en el estudio de la Torá, participar en los rezos diarios bajo el minhag Halabi, y formar parte de una comunidad cálida y comprometida con sus tradiciones.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-24 bg-cream-dark">
        <div className="max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold mb-6">Liderazgo</div>
          <h2 className="display-lg text-navy mb-12">Nuestro <span className="accent">Rab y colaboradores</span></h2>

          <div className="bg-cream-light border border-line p-8 lg:p-12">
            <p className="text-[15px] text-ink-soft leading-[1.8] italic">
              Esta sección será actualizada próximamente con la biografía de nuestro Rab y los colaboradores del Midrash. Para conocerlos en persona, los invitamos a unirse a nuestros rezos y clases — todos son bienvenidos.
            </p>
            <div className="mt-6 pt-6 border-t border-line/60 flex flex-wrap gap-3">
              <a href="/horarios" className="text-[13px] font-bold tracking-[0.15em] uppercase text-navy hover:text-gold transition-colors">
                Ver horarios →
              </a>
              <span className="text-ink-muted">·</span>
              <a href="/contacto" className="text-[13px] font-bold tracking-[0.15em] uppercase text-navy hover:text-gold transition-colors">
                Contáctanos →
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-24 bg-navy-deep text-cream">
        <div className="max-w-4xl mx-auto text-center">
          <div className="eyebrow eyebrow-line text-gold-light mb-6 inline-block">Visítanos</div>
          <h2 className="display-md mb-6">Plaza Polanco · <span className="accent-light">Ciudad de México</span></h2>
          <p className="text-[16px] text-cream/75 max-w-2xl mx-auto leading-[1.8] mb-10">
            Las puertas del Midrash están abiertas para los rezos diarios y las clases. Si es tu primera vez, escríbenos antes para darte la bienvenida y orientarte.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/horarios" className="bg-gold text-navy-deep px-8 py-3 text-[13px] font-bold tracking-[0.2em] uppercase hover:bg-gold-light transition-colors">
              Horarios de rezo
            </a>
            <a href="mailto:info@natantora.com" className="border border-cream/30 text-cream px-8 py-3 text-[13px] font-bold tracking-[0.2em] uppercase hover:border-gold hover:text-gold-light transition-colors">
              info@natantora.com
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
