import Link from 'next/link'

export const metadata = { title: 'Donativos — Midrash Natán Torá', description: 'Apoya el Midrash Natán Torá. Donaciones mensuales o aportaciones específicas.' }

export default function Donativos() {
  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Apoyo</div>
          <h1 className="display-lg">Apoya el <span className="accent-light">Midrash.</span></h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl">Tu donativo sostiene clases, becas, eventos y el espacio físico del Midrash. Tres maneras de aportar.</p>
        </div>
      </section>
      <section className="px-6 py-20 lg:py-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line">
          <Plan label="Mensualidad" price="$500" unit="/mes" desc="Apoya mes a mes con un cargo recurrente." />
          <Plan label="Mensualidad+" price="$1,500" unit="/mes" desc="Sostiene una clase entera cada mes." featured />
          <Plan label="Donación libre" price="Tu monto" unit="" desc="Aporta una sola vez con el monto que prefieras." />
        </div>
        <div className="mt-16 max-w-3xl mx-auto text-center">
          <h3 className="display-md text-navy mb-4">Aportaciones <span className="accent">específicas</span></h3>
          <p className="text-[16px] text-ink-soft leading-relaxed mb-8">También puedes dedicar tu donativo a un proyecto puntual: becas de estudio, libros, mantenimiento del Hejal, eventos comunitarios, mejoras del espacio.</p>
          <Link href="/contacto" className="link-gold">Contáctanos para coordinar →</Link>
        </div>
      </section>
    </>
  )
}

function Plan({ label, price, unit, desc, featured }: { label: string; price: string; unit: string; desc: string; featured?: boolean }) {
  return (
    <div className={`p-8 lg:p-10 ${featured ? 'bg-navy text-cream' : 'bg-cream-light text-ink'}`}>
      <div className={`eyebrow eyebrow-line mb-4 ${featured ? 'text-gold-light' : 'text-gold'}`}>{label}</div>
      <div className="mb-3"><span className={`text-[36px] font-bold ${featured ? 'text-cream' : 'text-navy'}`}>{price}</span><span className={`text-[15px] ${featured ? 'text-cream/60' : 'text-ink-soft'}`}>{unit}</span></div>
      <p className={`text-[14px] leading-relaxed mb-7 ${featured ? 'text-cream/75' : 'text-ink-soft'}`}>{desc}</p>
      <button className={`w-full text-center py-3 text-[12px] tracking-[0.15em] uppercase font-medium transition-colors ${featured ? 'bg-gold text-navy-deep hover:bg-gold-light' : 'bg-navy text-cream hover:bg-navy-deep'}`}>Donar</button>
    </div>
  )
}
