'use client'

import { useState, useMemo } from 'react'
import { isStorageUrl } from '@/lib/class-media'

type ClassRow = {
  id: string
  title: string
  description: string | null
  category: string | null
  media_type: 'video' | 'audio' | 'text' | null
  media_url: string | null
  rabbi: string | null
  duration_minutes: number | null
  published_at: string | null
  created_at: string
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MESES_ES[d.getUTCMonth()].slice(0, 3)}. ${d.getUTCFullYear()}`
}

function formatDuration(min: number | null): string {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  text: 'Texto',
}

const TYPE_COLOR: Record<string, string> = {
  video: 'bg-navy text-cream',
  audio: 'bg-gold text-navy-deep',
  text: 'bg-ink text-cream',
}

/**
 * Convierte una URL de YouTube/Vimeo en su URL de embed.
 * Si no es reconocida, devuelve null para que el caller use fallback.
 */
function toEmbedUrl(url: string): string | null {
  if (!url) return null
  // YouTube: https://youtu.be/VIDEO_ID  |  https://www.youtube.com/watch?v=VIDEO_ID  |  shorts
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`
  // Vimeo: https://vimeo.com/VIDEO_ID
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

/**
 * Detecta plataforma de la URL para mostrar el nombre amigable al fallback link.
 */
function externalPlatformName(url: string): string {
  if (/youtu\.?be/i.test(url)) return 'YouTube'
  if (/vimeo\.com/i.test(url)) return 'Vimeo'
  if (/soundcloud\.com/i.test(url)) return 'SoundCloud'
  if (/spotify\.com/i.test(url)) return 'Spotify'
  return 'otra pestaña'
}

export default function BibliotecaClient({ classes, error }: { classes: ClassRow[]; error: string | null }) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'audio' | 'text'>('all')
  const [rabbiFilter, setRabbiFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'title'>('recent')
  const [playingId, setPlayingId] = useState<string | null>(null)

  const rabbis = useMemo(() => {
    const set = new Set<string>()
    classes.forEach(c => c.rabbi && set.add(c.rabbi))
    return Array.from(set).sort()
  }, [classes])

  const filtered = useMemo(() => {
    let result = classes
    if (typeFilter !== 'all') result = result.filter(c => c.media_type === typeFilter)
    if (rabbiFilter !== 'all') result = result.filter(c => c.rabbi === rabbiFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q) ||
        (c.rabbi ?? '').toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q)
      )
    }
    const sorted = [...result]
    if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const da = a.published_at ?? a.created_at
        const db = b.published_at ?? b.created_at
        return db.localeCompare(da)
      })
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => {
        const da = a.published_at ?? a.created_at
        const db = b.published_at ?? b.created_at
        return da.localeCompare(db)
      })
    } else {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    }
    return sorted
  }, [classes, query, typeFilter, rabbiFilter, sortBy])

  if (error) {
    return (
      <section className="px-6 py-20 bg-cream">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[15px] text-ink-soft">No se pudieron cargar las clases en este momento. Intenta de nuevo en unos minutos.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="px-6 py-16 lg:py-20 bg-cream">
      <div className="max-w-6xl mx-auto">

        {/* Search + filters */}
        <div className="mb-10 space-y-5">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por t&iacute;tulo, rabino o tema..."
              className="w-full bg-cream-light border border-line px-5 py-4 text-[15px] text-navy placeholder:text-ink-muted focus:outline-none focus:border-gold transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-navy text-[13px] font-semibold uppercase tracking-wider"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'video', 'audio', 'text'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-4 py-2 text-[11px] font-bold tracking-[0.18em] uppercase border transition-all ${
                    typeFilter === t
                      ? 'bg-navy-deep text-cream border-navy-deep'
                      : 'bg-cream-light text-ink-soft border-line hover:border-navy'
                  }`}
                >
                  {t === 'all' ? 'Todo' : TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            {rabbis.length > 0 && (
              <select
                value={rabbiFilter}
                onChange={e => setRabbiFilter(e.target.value)}
                className="bg-cream-light border border-line px-4 py-2 text-[13px] text-navy uppercase tracking-wider focus:outline-none focus:border-gold"
              >
                <option value="all">Todos los rabinos</option>
                {rabbis.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-cream-light border border-line px-4 py-2 text-[13px] text-navy uppercase tracking-wider focus:outline-none focus:border-gold ml-auto"
            >
              <option value="recent">M&aacute;s recientes</option>
              <option value="oldest">M&aacute;s antiguas</option>
              <option value="title">T&iacute;tulo A-Z</option>
            </select>
          </div>

          <div className="text-[12px] text-ink-muted uppercase tracking-widest font-semibold">
            {filtered.length} {filtered.length === 1 ? 'clase' : 'clases'}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="bg-cream-light border border-line p-12 lg:p-16 text-center">
            <div className="eyebrow text-gold mb-4">Biblioteca en construcci&oacute;n</div>
            <h3 className="text-[20px] lg:text-[22px] font-bold text-navy uppercase tracking-wide mb-4">
              {classes.length === 0 ? 'Pronto subiremos clases' : 'Sin resultados'}
            </h3>
            <p className="text-[15px] text-ink-soft leading-[1.7] max-w-xl mx-auto">
              {classes.length === 0
                ? 'Estamos preparando la biblioteca de clases del Midrash. Reg&iacute;strate para recibir aviso cuando publiquemos las primeras grabaciones.'
                : 'Intenta con otros t&eacute;rminos de b&uacute;squeda o quita algunos filtros.'}
            </p>
            {classes.length === 0 && (
              <a href="/auth/registro" className="inline-block mt-8 bg-gold text-navy-deep px-6 py-3 text-[12px] font-bold tracking-[0.2em] uppercase hover:bg-gold-light transition-colors">
                Registrarme
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
            {filtered.map(c => {
              const type = c.media_type ?? 'text'
              const isPlaying = playingId === c.id
              return (
                <article key={c.id} className="bg-cream-light p-7 lg:p-8 hover:bg-white transition-colors flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-1 ${TYPE_COLOR[type]}`}>
                      {TYPE_LABEL[type]}
                    </span>
                    {c.duration_minutes && (
                      <span className="text-[11px] text-ink-muted tabular-nums">
                        {formatDuration(c.duration_minutes)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-[17px] lg:text-[18px] font-bold text-navy mb-2 leading-tight">
                    {c.title}
                  </h3>

                  {c.rabbi && (
                    <div className="text-[11px] text-gold uppercase tracking-widest font-bold mb-3">
                      {c.rabbi}
                    </div>
                  )}

                  {c.description && (
                    <p className="text-[14px] text-ink-soft leading-relaxed mb-5 flex-1 line-clamp-3">
                      {c.description}
                    </p>
                  )}

                  <div className="mt-auto pt-4 border-t border-line/60 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-ink-muted">
                      {formatDate(c.published_at ?? c.created_at)}
                    </span>

                    {c.media_url && type === 'audio' && (
                      <button
                        onClick={() => setPlayingId(isPlaying ? null : c.id)}
                        className="text-[11px] font-bold tracking-[0.15em] uppercase text-navy hover:text-gold transition-colors"
                      >
                        {isPlaying ? 'Cerrar' : 'Reproducir &rarr;'}
                      </button>
                    )}
                    {c.media_url && type === 'video' && (
                      <button
                        onClick={() => setPlayingId(isPlaying ? null : c.id)}
                        className="text-[11px] font-bold tracking-[0.15em] uppercase text-navy hover:text-gold transition-colors"
                      >
                        {isPlaying ? 'Cerrar' : 'Ver video →'}
                      </button>
                    )}
                    {c.media_url && type === 'text' && (
                      <a
                        href={c.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold tracking-[0.15em] uppercase text-navy hover:text-gold transition-colors"
                      >
                        Leer &rarr;
                      </a>
                    )}
                  </div>

                  {isPlaying && c.media_url && type === 'audio' && (
                    <div className="mt-4 pt-4 border-t border-line/60">
                      {(() => {
                        // 1. Si es archivo subido a nuestro Storage: player nativo HTML5
                        if (isStorageUrl(c.media_url!)) {
                          return (
                            <audio controls preload="metadata" src={c.media_url!} className="w-full">
                              Tu navegador no soporta audio. <a href={c.media_url!} className="text-gold">Descargar</a>
                            </audio>
                          )
                        }
                        // 2. Si es YouTube/Vimeo: embed iframe con fallback
                        const embed = toEmbedUrl(c.media_url!)
                        const platform = externalPlatformName(c.media_url!)
                        if (embed) {
                          return (
                            <>
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  src={embed}
                                  className="absolute inset-0 w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                  title={c.title}
                                />
                              </div>
                              <a
                                href={c.media_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-3 text-[12px] text-ink-soft hover:text-gold transition-colors"
                              >
                                ¿No carga? Ver en {platform} ↗
                              </a>
                            </>
                          )
                        }
                        // 3. URL externa arbitraria
                        return (
                          <>
                            <audio controls src={c.media_url!} className="w-full">
                              Tu navegador no soporta audio. <a href={c.media_url!} className="text-gold">Descargar</a>
                            </audio>
                            <a
                              href={c.media_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block mt-3 text-[12px] text-ink-soft hover:text-gold transition-colors"
                            >
                              ¿Problemas? Abrir en {platform} ↗
                            </a>
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {isPlaying && c.media_url && type === 'video' && (
                    <div className="mt-4 pt-4 border-t border-line/60">
                      {(() => {
                        // 1. Archivo subido a Storage: video nativo HTML5
                        if (isStorageUrl(c.media_url!)) {
                          return (
                            <video controls preload="metadata" src={c.media_url!} className="w-full bg-black" playsInline>
                              Tu navegador no soporta video.{' '}
                              <a href={c.media_url!} className="text-gold">Descargar</a>
                            </video>
                          )
                        }
                        // 2. YouTube/Vimeo: iframe + fallback
                        const embed = toEmbedUrl(c.media_url!)
                        const platform = externalPlatformName(c.media_url!)
                        if (embed) {
                          return (
                            <>
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  src={embed}
                                  className="absolute inset-0 w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                  title={c.title}
                                />
                              </div>
                              <a
                                href={c.media_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-3 text-[12px] text-ink-soft hover:text-gold transition-colors"
                              >
                                ¿No carga? Ver en {platform} ↗
                              </a>
                            </>
                          )
                        }
                        // 3. URL externa arbitraria
                        return (
                          <div className="text-[13px] text-ink-soft">
                            No se puede reproducir aquí.{' '}
                            <a
                              href={c.media_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gold font-bold hover:underline"
                            >
                              Ver en {platform} →
                            </a>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {classes.length > 0 && (
          <p className="mt-12 text-center text-[12px] text-ink-muted">
            &iquest;Buscas una clase espec&iacute;fica que no encuentras? Escr&iacute;benos a{' '}
            <a href="mailto:info@natantora.com" className="text-gold hover:underline">info@natantora.com</a>
          </p>
        )}
      </div>
    </section>
  )
}
