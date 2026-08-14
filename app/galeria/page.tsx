import { CATEGORY_LABEL, ALL_CATEGORIES, type Category } from "@/lib/gallery";
import { listPhotos } from "@/lib/gallery-server";

export const metadata = {
  title: "Galería — Midrash Natán Torá",
  description: "Momentos de la comunidad, clases, rezos y eventos del Midrash Natán Torá.",
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function Galeria() {
  const photos = await listPhotos();

  // Agrupar por categoría
  const byCategory: Record<Category, typeof photos> = {
    shabat: [],
    fiesta: [],
    clase: [],
    evento: [],
    general: [],
  };
  for (const p of photos) byCategory[p.category].push(p);

  return (
    <>
      <section className="bg-navy-deep text-cream py-20 lg:py-24 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div className="relative max-w-5xl mx-auto">
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Galería</div>
          <h1 className="display-lg">
            Momentos de la <span className="accent-light">comunidad.</span>
          </h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl">
            Fotos de Shabat, clases, eventos y fiestas mayores del Midrash Natán Torá.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-28 bg-cream">
        <div className="max-w-7xl mx-auto">
          {photos.length === 0 ? (
            <div className="border border-line bg-cream-light p-16 text-center">
              <p className="text-[16px] text-ink-soft italic">
                Aún no hay fotos publicadas. Las primeras imágenes aparecerán pronto.
              </p>
            </div>
          ) : (
            <div className="space-y-16 lg:space-y-24">
              {ALL_CATEGORIES.map((cat) => {
                const catPhotos = byCategory[cat];
                if (catPhotos.length === 0) return null;
                return (
                  <section key={cat}>
                    <div className="flex items-baseline justify-between mb-6 lg:mb-8">
                      <h2 className="serif-display text-navy text-[28px] lg:text-[36px]">
                        {CATEGORY_LABEL[cat]}
                      </h2>
                      <div className="text-[11px] tracking-[0.22em] uppercase text-ink-muted font-semibold">
                        {catPhotos.length} {catPhotos.length === 1 ? "foto" : "fotos"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[200px] lg:auto-rows-[240px] gap-2">
                      {catPhotos.map((p, i) => {
                        // Variar tamaños: cada 5ta tall, cada 7ma wide
                        const tall = i % 5 === 0;
                        const wide = i % 7 === 0 && !tall;
                        return (
                          <a
                            key={p.path}
                            href={p.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              "relative overflow-hidden group bg-cream-dark " +
                              (tall ? "row-span-2 " : "") +
                              (wide ? "col-span-2 " : "")
                            }
                          >
                            <img
                              src={p.publicUrl}
                              alt={p.caption || `${CATEGORY_LABEL[cat]} — Midrash Natán Torá`}
                              className="w-full h-full object-cover transition-transform duration-700 ease-out-quart group-hover:scale-105"
                              loading="lazy"
                            />
                            {p.caption && (
                              <>
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-navy-deep/85 pointer-events-none" />
                                <div className="absolute bottom-4 left-4 right-4 text-cream">
                                  <div className="text-[13px] font-semibold tracking-wide leading-tight">
                                    {p.caption}
                                  </div>
                                </div>
                              </>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
