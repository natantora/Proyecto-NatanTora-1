'use client'

import { useState, useRef } from 'react'
import type { Role } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
  MAX_VIDEO_SIZE_MB,
  MAX_AUDIO_SIZE_MB,
  isStorageUrl,
} from '@/lib/class-media'

type MediaType = 'video' | 'audio' | 'text'

type ClassRow = {
  id: string
  title: string
  description: string | null
  category: string | null
  media_type: MediaType | null
  media_url: string | null
  rabbi: string | null
  duration_minutes: number | null
  published: boolean
  published_at: string | null
  pending_review: boolean | null
  owner_id: string | null
  rejection_reason: string | null
  created_at: string
}

type FormState = {
  title: string
  rabbi: string
  category: string
  media_type: MediaType
  media_url: string
  duration_minutes: number | ''
  description: string
  published: boolean
}

const INITIAL_FORM: FormState = {
  title: '',
  rabbi: '',
  category: 'Halajá',
  media_type: 'audio',
  media_url: '',
  duration_minutes: '',
  description: '',
  published: true,
}

const CATEGORIES = ['Halajá', 'Guemará', 'Parashá', 'Mussar', 'Tefilá', 'Filosofía', 'Mujeres', 'Bné Mitzvá', 'General']

export default function ClassesAdmin({
  initialClasses = [],
  currentUserId,
  currentUserRole,
  canPublishDirect,
  canEditAll,
}: {
  initialClasses?: ClassRow[]
  currentUserId: string
  currentUserRole: Role
  canPublishDirect: boolean
  canEditAll: boolean
}) {
  const [classes, setClasses] = useState<ClassRow[]>(initialClasses)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // null = crear, string = editar
  const [form, setForm] = useState<FormState>({
    ...INITIAL_FORM,
    published: canPublishDirect,
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const isRabino = currentUserRole === 'rabino'
  const isEditing = editingId !== null

  function openCreate() {
    setEditingId(null)
    setForm({ ...INITIAL_FORM, published: canPublishDirect })
    setShowForm(true)
    setMsg(null)
  }

  function openEdit(c: ClassRow) {
    setEditingId(c.id)
    setForm({
      title: c.title || '',
      rabbi: c.rabbi || '',
      category: c.category || 'Halajá',
      media_type: (c.media_type || 'audio') as MediaType,
      media_url: c.media_url || '',
      duration_minutes: c.duration_minutes ?? '',
      description: c.description || '',
      published: !!c.published,
    })
    setShowForm(true)
    setMsg(null)
    // Scroll al top del form
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...INITIAL_FORM, published: canPublishDirect })
    setMsg(null)
  }

  async function handleSubmit() {
    if (!form.title.trim()) { setMsg('El título es obligatorio'); return }
    setLoading(true); setMsg(null)
    try {
      const payload = {
        title: form.title.trim(),
        rabbi: form.rabbi.trim() || 'Rab Natán',
        category: form.category,
        media_type: form.media_type,
        media_url: form.media_url.trim() || null,
        duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
        description: form.description.trim() || null,
        published: form.published,
      }

      if (isEditing) {
        // PATCH
        const res = await fetch('/api/classes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          setClasses(classes.map(x => x.id === editingId
            ? { ...x, ...payload, published_at: payload.published ? (x.published_at || new Date().toISOString()) : null }
            : x))
          setMsg('Clase actualizada.')
          closeForm()
        } else {
          setMsg(json.error || 'Error al actualizar')
        }
      } else {
        // POST
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.class) {
          setClasses([json.class, ...classes])
          setMsg(isRabino
            ? 'Clase enviada para revisión. Un administrador la publicará pronto.'
            : 'Clase agregada.')
          closeForm()
        } else {
          setMsg(json.error || 'Error al guardar')
        }
      }
    } catch (e: any) {
      setMsg(e?.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  async function togglePublished(c: ClassRow) {
    if (!canEditAll) {
      setMsg('Solo administradores pueden publicar/despublicar.')
      return
    }
    const newVal = !c.published
    const res = await fetch('/api/classes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, published: newVal, pending_review: newVal ? false : c.pending_review }),
    })
    if (res.ok) {
      setClasses(classes.map(x => x.id === c.id ? { ...x, published: newVal, pending_review: newVal ? false : x.pending_review } : x))
    } else {
      const j = await res.json().catch(() => ({}))
      setMsg(j.error || 'Error al cambiar publicación')
    }
  }

  async function handleDelete(c: ClassRow) {
    if (!confirm(`¿Eliminar "${c.title}"? Esta acción no se puede deshacer.`)) return
    // FIX: enviar id en query string Y en body (compat con ambos)
    const res = await fetch(`/api/classes?id=${encodeURIComponent(c.id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id }),
    })
    if (res.ok) {
      setClasses(classes.filter(x => x.id !== c.id))
      setMsg('Clase eliminada.')
    } else {
      const j = await res.json().catch(() => ({}))
      setMsg(j.error || 'Error al borrar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-ink-soft">
          {classes.length} {classes.length === 1 ? 'clase' : 'clases'}
          {!isRabino && ` · ${classes.filter(c => c.published).length} publicadas`}
          {isRabino && ` · ${classes.filter(c => c.pending_review).length} en revisión`}
        </p>
        <button
          onClick={() => showForm ? closeForm() : openCreate()}
          className="bg-navy-deep text-cream px-5 py-2.5 text-[12px] font-bold tracking-[0.18em] uppercase hover:bg-navy transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Agregar clase'}
        </button>
      </div>

      {msg && (
        <div className="bg-cream-dark border border-line px-4 py-3 text-[14px] text-navy">
          {msg}
        </div>
      )}

      {isRabino && (
        <div className="bg-gold/10 border border-gold/30 px-4 py-3 text-[13px] text-navy">
          <strong>Importante:</strong> tus clases se envían en revisión. Un administrador las aprobará antes de publicarlas en la biblioteca pública.
        </div>
      )}

      {showForm && (
        <div className="bg-cream-light border border-line p-6 space-y-4">
          <div className="flex items-center gap-2 -mt-2 mb-2">
            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-1 ${
              isEditing ? 'bg-gold text-navy-deep' : 'bg-navy text-cream'
            }`}>
              {isEditing ? 'Editando clase' : 'Nueva clase'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Título *">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white" />
            </Field>
            <Field label="Rabino / Maestro">
              <input type="text" value={form.rabbi} onChange={e => setForm({ ...form, rabbi: e.target.value })}
                placeholder="Rab Natán" className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white" />
            </Field>
            <Field label="Categoría">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Tipo de medio">
              <select value={form.media_type} onChange={e => setForm({ ...form, media_type: e.target.value as MediaType })}
                className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white">
                <option value="audio">Audio</option>
                <option value="video">Video</option>
                <option value="text">Texto</option>
              </select>
            </Field>
            {form.media_type !== 'text' && (
              <Field label={form.media_type === 'video' ? 'Video' : 'Audio'} full>
                <MediaUploader
                  mediaType={form.media_type}
                  currentUrl={form.media_url}
                  onUploaded={(url) => setForm(prev => ({ ...prev, media_url: url }))}
                  onClear={() => setForm(prev => ({ ...prev, media_url: '' }))}
                />
              </Field>
            )}
            <Field label="Duración (minutos)">
              <input type="number" min="0" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="45" className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white" />
            </Field>
            {canPublishDirect && (
              <Field label="Publicar">
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })}
                    className="w-5 h-5" />
                  <span className="text-[13px] text-ink-soft">Visible en la biblioteca pública</span>
                </label>
              </Field>
            )}
            <Field label="Descripción" full>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3} className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white resize-y" />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={closeForm}
              className="px-5 py-2 text-[12px] font-bold tracking-[0.18em] uppercase text-ink-soft hover:text-navy">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="bg-gold text-navy-deep px-6 py-2 text-[12px] font-bold tracking-[0.18em] uppercase hover:bg-gold-light disabled:opacity-50 transition-colors">
              {loading ? 'Guardando...' : (isEditing ? 'Guardar cambios' : (isRabino ? 'Enviar a revisión' : 'Guardar clase'))}
            </button>
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="bg-cream-light border border-line p-12 text-center">
          <p className="text-[15px] text-ink-soft">No hay clases todavía. Tap &quot;+ Agregar clase&quot; para empezar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map(c => {
            const canEditThis = canEditAll || c.owner_id === currentUserId
            return (
              <div key={c.id} className="bg-cream-light border border-line p-4 flex items-start gap-4 hover:border-gold transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 ${
                      c.media_type === 'audio' ? 'bg-gold text-navy-deep' :
                      c.media_type === 'video' ? 'bg-navy text-cream' :
                      'bg-ink text-cream'
                    }`}>
                      {c.media_type ?? 'texto'}
                    </span>
                    {c.category && <span className="text-[10px] text-ink-muted uppercase tracking-wider">{c.category}</span>}
                    {c.pending_review && (
                      <span className="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-300 uppercase tracking-wider font-bold px-1.5 py-0.5">
                        En revisión
                      </span>
                    )}
                    {!c.published && !c.pending_review && (
                      <span className="text-[10px] text-rose-600 uppercase tracking-wider font-bold">
                        Borrador
                      </span>
                    )}
                    {c.published && (
                      <span className="text-[10px] text-green-700 uppercase tracking-wider font-bold">
                        Publicada
                      </span>
                    )}
                  </div>
                  <h4 className="text-[15px] font-bold text-navy mb-1 truncate">{c.title}</h4>
                  {c.rabbi && <div className="text-[12px] text-gold font-bold uppercase tracking-widest">{c.rabbi}</div>}
                  {c.media_url && <div className="text-[11px] text-ink-muted truncate mt-1">{c.media_url}</div>}
                  {c.rejection_reason && (
                    <div className="mt-2 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1.5">
                      <strong>Devuelta:</strong> {c.rejection_reason}
                    </div>
                  )}
                </div>
                {canEditThis && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => openEdit(c)}
                      className="bg-navy text-cream px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase hover:bg-gold hover:text-navy transition-colors">
                      Editar
                    </button>
                    {canEditAll && (
                      <button onClick={() => togglePublished(c)}
                        className="text-[10px] font-bold tracking-wider uppercase text-navy hover:text-gold py-1">
                        {c.published ? 'Despublicar' : 'Publicar'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(c)}
                      className="text-[10px] font-bold tracking-wider uppercase text-rose-600 hover:text-rose-800 py-1">
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function MediaUploader({
  mediaType,
  currentUrl,
  onUploaded,
  onClear,
}: {
  mediaType: MediaType
  currentUrl: string
  onUploaded: (url: string) => void
  onClear: () => void
}) {
  const [mode, setMode] = useState<'upload' | 'url'>(() => {
    if (currentUrl && !isStorageUrl(currentUrl)) return 'url'
    return 'upload'
  })
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isVideo = mediaType === 'video'
  const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_AUDIO_TYPES
  const maxMB = isVideo ? MAX_VIDEO_SIZE_MB : MAX_AUDIO_SIZE_MB
  const accept = allowedTypes.join(',')

  async function handleFile(file: File) {
    setError(null)
    if (!allowedTypes.includes(file.type)) {
      setError(`Formato no permitido (${file.type}). Usa ${isVideo ? 'MP4, MOV, WebM' : 'MP3, M4A, WAV'}.`)
      return
    }
    if (file.size > maxMB * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1)
      setError(`Archivo muy grande (${sizeMB}MB). Máximo ${maxMB}MB.`)
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const signRes = await fetch('/api/class-media/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          kind: mediaType,
        }),
      })
      const signJson = await signRes.json()
      if (!signRes.ok) {
        throw new Error(signJson.error || 'Error pidiendo permiso de subida')
      }

      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from('class-media')
        .uploadToSignedUrl(signJson.path, signJson.token, file, {
          contentType: file.type,
          upsert: false,
        })
      if (upErr) throw new Error(upErr.message)

      setProgress(100)
      onUploaded(signJson.publicUrl)
    } catch (e: any) {
      setError(e?.message || 'Error subiendo archivo')
    } finally {
      setUploading(false)
    }
  }

  if (currentUrl && isStorageUrl(currentUrl)) {
    return (
      <div className="space-y-2">
        <div className="bg-cream-dark border border-line p-3 flex items-center gap-3">
          <span className="text-[20px]">✓</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-navy">Archivo subido</p>
            <p className="text-[11px] text-ink-soft truncate">{currentUrl.split('/').pop()}</p>
          </div>
          <button type="button" onClick={onClear}
            className="text-[11px] text-ink-soft hover:text-navy underline">Cambiar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-cream-dark p-1 w-fit">
        <button type="button" onClick={() => setMode('upload')}
          className={`px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-colors ${
            mode === 'upload' ? 'bg-navy text-cream' : 'text-ink-soft hover:text-navy'
          }`}>
          Subir archivo
        </button>
        <button type="button" onClick={() => setMode('url')}
          className={`px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-colors ${
            mode === 'url' ? 'bg-navy text-cream' : 'text-ink-soft hover:text-navy'
          }`}>
          Pegar link
        </button>
      </div>

      {mode === 'upload' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
            disabled={uploading}
            className="block w-full text-[13px] file:mr-3 file:py-2 file:px-4 file:border-0 file:bg-navy file:text-cream file:text-[11px] file:font-bold file:tracking-wider file:uppercase file:cursor-pointer"
          />
          {uploading && (
            <div className="mt-2">
              <div className="h-1 bg-cream-dark overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-ink-soft mt-1">Subiendo… no cierres esta pantalla</p>
            </div>
          )}
          {!uploading && (
            <p className="text-[11px] text-ink-soft mt-1.5">
              {isVideo ? 'MP4, MOV o WebM' : 'MP3, M4A o WAV'} · máx {maxMB}MB · se guarda en el servidor del Midrash
            </p>
          )}
        </div>
      ) : (
        <div>
          <input
            type="url"
            value={currentUrl && !isStorageUrl(currentUrl) ? currentUrl : ''}
            onChange={(e) => onUploaded(e.target.value)}
            placeholder="https://youtu.be/... o https://vimeo.com/..."
            className="w-full border border-line px-3 py-2 text-[14px] focus:outline-none focus:border-gold bg-white"
          />
          <p className="text-[11px] text-ink-soft mt-1.5">
            YouTube o Vimeo. Si el video tiene embed bloqueado por el uploader, no se verá inline (preferimos subir archivo).
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-[12px]">
          {error}
        </div>
      )}
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <div className="text-[11px] text-ink-muted uppercase tracking-widest font-bold mb-1">{label}</div>
      {children}
    </label>
  )
}
