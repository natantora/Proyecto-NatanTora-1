import BibliotecaClient from './BibliotecaClient'
import { createClient } from '@/lib/data/server'

export const metadata = {
  title: 'Biblioteca de Clases — Midrash Natán Torá',
  description: 'Biblioteca de clases de Torá, Halajá, Guemará, Parashá y más, en audio y video, en el Midrash Natán Torá.'
}

export const dynamic = 'force-dynamic'

export default async function Clases() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, title, description, category, media_type, media_url, rabbi, duration_minutes, published_at, created_at')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(500)

  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Biblioteca de Clases</div>
          <h1 className="display-lg">Tor&aacute; al <span className="accent-light">alcance.</span></h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl leading-[1.7]">
            Halaj&aacute;, Guemar&aacute;, Parash&aacute;, Mussar y m&aacute;s. Clases en audio y video con nuestros maestros, bajo minhag Halabi de Aram Tzob&aacute;.
          </p>
        </div>
      </section>

      <BibliotecaClient classes={classes ?? []} error={error?.message ?? null} isLoggedIn={!!user} />
    </>
  )
}
