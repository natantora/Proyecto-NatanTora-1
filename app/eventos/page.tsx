import Link from 'next/link'

export const metadata = {
  title: 'Eventos — Midrash Natán Torá',
  description: 'Eventos comunitarios, cenas, fiestas mayores e inscripciones del Midrash Natán Torá.',
}

const proximosEventos = [
  { id: 1, fecha: { dia: '22', mes: 'May' }, titulo: 'Cena de Lag baOmer', meta: '18:30 · Salón principal · Cupo: 80 personas', inscritos: 25, cupo: 80 },
  { id: 2, fecha: { dia: '02', mes: 'Jun' }, titulo: 'Shavuot — Tikún Leyl noche entera', meta: '22:00 a 05:00 · Estudio toda la noche · Refrigerio incluido', inscritos: 42, cupo: 120 },
  { id: 3, fecha: { dia: '23', mes: 'Sep' }, titulo: 'Rosh haShaná — Selijot y Tefilot', meta: 'Fiesta mayor · Plano de asientos · Standard / Premium / VIP', inscritos: 130, cupo: 290, asientos: true },
]

const pasadosEventos = [
  { fecha: 'Abril 2026', titulo: 'Pésaj — Séder comunitario' },
  { fecha: 'Marzo 2026', titulo: 'Purim — Lectura de la Meguíla' },
  { fecha: 'Enero 2026', titulo: 'Tu BiShvat — Mesa de frutos' },
  { fecha: 'Diciembre 2025', titulo: 'Janucá — Encendido público' },
]

export default function Eventos() {
  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Eventos</div>
          <h1 className="display-lg">Agenda de la <span className="accent-light">comunidad.</span></h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl">Inscríbete o muestra interés. Miembros registrados tienen prioridad en eventos de fiestas mayores y acceso al plano de asientos.</p>
        </div>
      </section>
      <section className="px-6 py-20 lg:py-24 bg-cream">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <div className="eyebrow eyebrow-line text-gold mb-4">Próximos eventos</div>
            <h2 className="display-md text-navy">Qué viene en el Midrash</h2>
          </div>
          <div className="bg-navy">
            <ul className="divide-y divide-navy-soft">
              {proximosEventos.map((e) => (
                <li key={e.id} className="p-7 lg:p-9 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 md:gap-10 items-center transition-colors hover:bg-[#14213d]">
                  <div className="md:text-center md:pr-8 md:border-r border-navy-soft md:min-w-[100px]">
                    <div className="text-[40px] lg:text-[44px] font-bold text-gold-light leading-none">{e.fecha.dia}</div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-cream/60 mt-2">{e.fecha.mes}</div>
                  </div>
                  <div>
                    <h3 className="text-[17px] text-cream font-bold uppercase tracking-wide mb-1.5">{e.titulo}</h3>
                    <div className="text-[13px] text-cream/65">{e.meta}</div>
                    <div className="text-[12px] text-gold-light mt-2 tracking-wide">{e.inscritos} inscritos · cupo {e.cupo}</div>
                  </div>
                  <Link href={e.asientos ? '/asientos' : '/auth/login'} className="text-[11px] tracking-[0.2em] uppercase text-gold-light border border-gold/40 px-5 py-3 hover:bg-gold hover:text-navy-deep hover:border-gold transition-colors whitespace-nowrap">{e.asientos ? 'Ver asientos' : 'Inscribirme'}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="px-6 py-20 bg-cream-dark">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <div className="eyebrow eyebrow-line text-gold mb-4">Historial</div>
            <h2 className="display-md text-navy">Eventos pasados</h2>
            <p className="mt-3 text-[16px] text-ink-soft max-w-xl">Un registro de los momentos que hemos compartido como comunidad.</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border border-line">
            {pasadosEventos.map((e, i) => (
              <li key={i} className="bg-cream-light p-6 lg:p-7 flex justify-between items-center">
                <div>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-gold mb-1">{e.fecha}</div>
                  <div className="text-[16px] text-navy font-medium">{e.titulo}</div>
                </div>
                <Link href="/galeria" className="text-[11px] tracking-[0.15em] uppercase text-ink-muted hover:text-gold">Galería →</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
