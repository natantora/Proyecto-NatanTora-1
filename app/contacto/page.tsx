export const metadata = { title: 'Contacto — Midrash Natán Torá', description: 'Contacta al Midrash Natán Torá en Plaza Polanco, Ciudad de México.' }

export default function Contacto() {
  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Contacto</div>
          <h1 className="display-lg">Escríbenos.</h1>
        </div>
      </section>
      <section className="px-6 py-20 lg:py-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <div className="eyebrow text-gold mb-4">Datos generales</div>
            <ul className="space-y-5">
              <li>
                <div className="text-[11px] tracking-[0.2em] uppercase text-ink-muted mb-1">Correo</div>
                <a href="mailto:info@natantora.com" className="text-[18px] text-navy hover:text-gold transition-colors">info@natantora.com</a>
              </li>
              <li>
                <div className="text-[11px] tracking-[0.2em] uppercase text-ink-muted mb-1">Dirección</div>
                <div className="text-[16px] text-ink">Plaza Polanco<br />Ciudad de México</div>
                <p className="text-[11px] text-ink-muted font-medium uppercase tracking-wider mt-2">Dirección completa visible para miembros registrados.</p>
              </li>
            </ul>
          </div>
          <form className="space-y-5">
            <div className="eyebrow text-gold mb-4">Envíanos un mensaje</div>
            <div>
              <label className="block text-[11px] tracking-[0.15em] uppercase text-ink-muted mb-2">Nombre</label>
              <input type="text" required className="w-full bg-cream-light border border-line px-4 py-3 text-[15px] text-ink focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.15em] uppercase text-ink-muted mb-2">Correo</label>
              <input type="email" required className="w-full bg-cream-light border border-line px-4 py-3 text-[15px] text-ink focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.15em] uppercase text-ink-muted mb-2">Mensaje</label>
              <textarea required rows={5} className="w-full bg-cream-light border border-line px-4 py-3 text-[15px] text-ink focus:outline-none focus:border-gold resize-none" />
            </div>
            <button type="submit" className="btn btn-dark">Enviar mensaje</button>
          </form>
        </div>
      </section>
    </>
  )
}
