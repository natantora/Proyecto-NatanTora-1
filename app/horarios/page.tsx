import SunCalc from 'suncalc'

export const metadata = {
  title: 'Horarios — Midrash Natán Torá',
  description: 'Horarios de rezos del Midrash Natán Torá. Minhag Halabi, halajot del Shulján HaMélej.'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CDMX = { lat: 19.43, lng: -99.13 }
const CDMX_OFFSET_MS = 6 * 60 * 60 * 1000

function formatTime(d: Date): string {
  const cdmx = new Date(d.getTime() - CDMX_OFFSET_MS)
  const hh = String(cdmx.getUTCHours()).padStart(2, '0')
  const mm = String(cdmx.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES_ES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDayLabel(d: Date): { dia: string; fecha: string } {
  const cdmx = new Date(d.getTime() - CDMX_OFFSET_MS)
  return {
    dia: DIAS_ES[cdmx.getUTCDay()],
    fecha: `${cdmx.getUTCDate()} ${MESES_ES_CORTO[cdmx.getUTCMonth()]}`
  }
}

function getWeek(): Date[] {
  const now = new Date()
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + i)
    d.setUTCHours(18, 0, 0, 0)
    days.push(d)
  }
  return days
}

const horarioFijo = [
  {
    dia: 'Domingo',
    rezos: [
      { nombre: 'Shajarit', hora: '8:00' },
      { nombre: 'Minjá', hora: '13:30' },
    ],
    nota: 'Arvit: 15 min antes del shkiá',
  },
  {
    dia: 'Lunes a Jueves',
    rezos: [
      { nombre: 'Shajarit · 1.er minyán', hora: '7:00' },
      { nombre: 'Shajarit · 2.º minyán', hora: '8:00' },
      { nombre: 'Minjá', hora: '13:30' },
    ],
    nota: 'Minjá / Arvit: 15 min antes del shkiá',
  },
  {
    dia: 'Viernes',
    rezos: [
      { nombre: 'Shajarit · 1.er minyán', hora: '7:00' },
      { nombre: 'Shajarit · 2.º minyán', hora: '8:00' },
    ],
    nota: 'Cabalat Shabat: 15 min antes del shkiá',
  },
  {
    dia: 'Shabat',
    rezos: [
      { nombre: 'Shajarit', hora: '8:30' },
    ],
    nota: 'Minjá / Arvit / Havdalá según calendario semanal',
  },
]

export default function Horarios() {
  const week = getWeek()
  const minjaArvitWeek = week.map(d => {
    const sunset = SunCalc.getTimes(d, CDMX.lat, CDMX.lng).sunset
    const tefila = new Date(sunset.getTime() - 15 * 60 * 1000)
    return {
      ...formatDayLabel(d),
      hora: formatTime(tefila),
      shkia: formatTime(sunset),
    }
  })

  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Horarios de Rezos</div>
          <h1 className="display-lg">Tefilá de la <span className="accent-light">semana.</span></h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl leading-[1.7]">
            Minhag Halabi de Aram Tzobá · Halajot del Shulján HaMélej. Los horarios de Minjá y Arvit se ajustan al shkiá de cada día, calculado para Ciudad de México.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-24 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold mb-6">Horario fijo</div>
          <h2 className="display-lg text-navy mb-12">Shajarit y <span className="accent">Minjá</span></h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {horarioFijo.map((d, idx) => (
              <article
                key={d.dia}
                className="group relative bg-cream-light border border-line p-8 lg:p-10 transition-all hover:border-gold hover:shadow-[0_8px_30px_-12px_rgba(184,146,74,0.25)]"
              >
                <div className="absolute -top-px left-8 right-8 h-[2px] bg-gold transition-all group-hover:left-0 group-hover:right-0" />
                <div className="text-[11px] text-gold tracking-[0.28em] uppercase font-bold mb-2">
                  {`— ${String(idx + 1).padStart(2, '0')}`}
                </div>
                <h3 className="text-[22px] lg:text-[24px] font-bold text-navy uppercase tracking-wide mb-7 leading-tight">
                  {d.dia}
                </h3>

                <ul className="space-y-3">
                  {d.rezos.map((r, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-4 border-b border-line/60 pb-3 last:border-b-0 last:pb-0">
                      <span className="text-[15px] text-ink leading-tight">{r.nombre}</span>
                      <span className="text-navy font-bold text-[22px] tabular-nums shrink-0">{r.hora}</span>
                    </li>
                  ))}
                </ul>

                {d.nota && (
                  <p className="text-[12px] text-ink-muted italic mt-5 pt-4 border-t border-line/40">{d.nota}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-24 bg-cream-dark">
        <div className="max-w-4xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold mb-6">Calculado al shkiá</div>
          <h2 className="display-lg text-navy mb-4">Minjá / Arvit · <span className="accent">esta semana</span></h2>
          <p className="text-[15px] text-ink-soft leading-[1.7] mb-10 max-w-2xl">
            15 minutos antes del shkiá de cada día. Estos horarios se recalculan automáticamente cada semana según la puesta del sol en CDMX.
          </p>

          <div className="bg-cream-light border border-line">
            <div className="grid grid-cols-[1fr_auto_auto] gap-6 px-6 py-4 border-b border-line bg-cream">
              <span className="text-[10px] font-bold text-ink-muted tracking-[0.25em] uppercase">Día</span>
              <span className="text-[10px] font-bold text-ink-muted tracking-[0.25em] uppercase text-right">Minjá / Arvit</span>
              <span className="text-[10px] font-bold text-ink-muted tracking-[0.25em] uppercase text-right">Shkiá</span>
            </div>
            {minjaArvitWeek.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-6 px-6 py-5 border-b border-line/60 last:border-b-0 items-baseline">
                <div>
                  <div className="text-[16px] text-navy font-medium capitalize">{d.dia}</div>
                  <div className="text-[12px] text-ink-muted">{d.fecha}</div>
                </div>
                <div className="text-[22px] font-bold text-navy tabular-nums text-right">{d.hora}</div>
                <div className="text-[14px] text-ink-soft tabular-nums text-right pt-1">{d.shkia}</div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-[13px] text-ink-muted leading-[1.7]">
            Horarios pueden ajustarse para fiestas mayores y ayunos.<br />
            Dudas: <a href="mailto:info@natantora.com" className="text-gold hover:underline">info@natantora.com</a>
          </p>
        </div>
      </section>
    </>
  )
}
