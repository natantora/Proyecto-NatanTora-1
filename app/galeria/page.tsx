import GalleryClient from "./GalleryClient";
import { listPhotos } from "@/lib/gallery-server";

export const metadata = {
  title: "Galería — Midrash Natán Torá",
  description: "Momentos de la comunidad, clases, rezos y eventos del Midrash Natán Torá.",
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function Galeria() {
  const photos = await listPhotos();

  return (
    <>
      <section className="relative overflow-hidden bg-navy-deep px-6 py-20 text-cream lg:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="eyebrow eyebrow-line mb-6 text-gold-light">Galería</div>
          <h1 className="display-lg">Momentos de la <span className="accent-light">comunidad.</span></h1>
          <p className="mt-5 max-w-2xl text-[17px] text-cream/75">
            Explora nuestros álbumes de Shabat, clases, eventos y fiestas mayores.
          </p>
        </div>
      </section>

      <section className="bg-cream px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-7xl">
          {photos.length === 0 ? (
            <div className="border border-line bg-cream-light p-16 text-center">
              <p className="text-[16px] italic text-ink-soft">
                Aún no hay fotos publicadas. Las primeras imágenes aparecerán pronto.
              </p>
            </div>
          ) : (
            <GalleryClient photos={photos} />
          )}
        </div>
      </section>
    </>
  );
}
