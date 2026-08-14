import SunCalc from 'suncalc'

const CDMX = { lat: 19.43, lng: -99.13 }
// CDMX is UTC-6 year-round (no DST since 2022)
const CDMX_OFFSET_MS = 6 * 60 * 60 * 1000

export const revalidate = 21600 // 6 hours

function getNextShabbatFriday(now = new Date()): Date {
  const d = new Date(now)
  const day = d.getDay()
  const daysUntilFriday = (5 - day + 7) % 7
  d.setDate(d.getDate() + daysUntilFriday)
  d.setHours(12, 0, 0, 0)
  return d
}

function getNextShabbatSaturday(friday: Date): Date {
  const sat = new Date(friday)
  sat.setDate(sat.getDate() + 1)
  return sat
}

// Bulletproof CDMX time formatter — does not depend on Node ICU/tzdata
function formatTime(d: Date): string {
  const cdmx = new Date(d.getTime() - CDMX_OFFSET_MS)
  const hh = String(cdmx.getUTCHours()).padStart(2, '0')
  const mm = String(cdmx.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatDate(d: Date): string {
  // Day name + day-of-month + month in Spanish, computed in CDMX time
  const cdmx = new Date(d.getTime() - CDMX_OFFSET_MS)
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${dias[cdmx.getUTCDay()]} ${cdmx.getUTCDate()} de ${meses[cdmx.getUTCMonth()]}`
}

async function getParasha(saturday: Date): Promise<string> {
  try {
    const yyyy = saturday.getUTCFullYear()
    const mm = String(saturday.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(saturday.getUTCDate()).padStart(2, '0')
    const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&nx=off&mf=off&ss=off&mod=off&s=on&i=off&lg=es&start=${yyyy}-${mm}-${dd}&end=${yyyy}-${mm}-${dd}`
    const res = await fetch(url, { next: { revalidate: 21600 } })
    if (!res.ok) return 'Parashá de la semana'
    const data = await res.json()
    const parashaItem = data.items?.find((it: any) => it.category === 'parashat')
    if (parashaItem?.hebrew) {
      // Title is like "Parashat Bamidbar" — keep as is
      return parashaItem.title || 'Parashá de la semana'
    }
    return parashaItem?.title || 'Parashá de la semana'
  } catch {
    return 'Parashá de la semana'
  }
}

export default async function ShabbatStrip() {
  const friday = getNextShabbatFriday()
  const sat = getNextShabbatSaturday(friday)
  const sunFri = SunCalc.getTimes(friday, CDMX.lat, CDMX.lng)
  const sunSat = SunCalc.getTimes(sat, CDMX.lat, CDMX.lng)
  const candleLighting = new Date(sunFri.sunset.getTime() - 20 * 60 * 1000)
  const shkia = sunFri.sunset
  const havdala = new Date(sunSat.sunset.getTime() + 30 * 60 * 1000)
  const parasha = await getParasha(sat)
  const dateStr = formatDate(friday)

  return (
    <section className="relative bg-cream-light border-y border-line overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, #B8924A 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }} />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-10 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-8 lg:gap-10 items-center">
          <div className="lg:border-r lg:border-line lg:pr-10">
            <div className="eyebrow text-gold mb-3">Esta semana</div>
            <div className="text-[20px] lg:text-[22px] font-bold text-navy uppercase tracking-wide leading-tight">
              Shabat · {parasha}
            </div>
            <div className="text-[13px] text-ink-soft mt-2 capitalize tracking-wide">
              {dateStr} · CDMX · Minhag Halabi
            </div>
          </div>
          <TimeBlock label="Encendido" value={formatTime(candleLighting)} />
          <TimeBlock label="Shkiá" value={formatTime(shkia)} />
          <TimeBlock label="Havdalá" value={formatTime(havdala)} />
        </div>
      </div>
    </section>
  )
}

function TimeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="lg:text-center lg:px-2 lg:border-r lg:border-line lg:last:border-r-0">
      <div className="text-[10px] tracking-[0.28em] uppercase text-gold font-bold mb-1.5">
        {label}
      </div>
      <div className="text-[32px] lg:text-[36px] font-bold text-navy tabular-nums leading-none">
        {value}
      </div>
    </div>
  )
}
