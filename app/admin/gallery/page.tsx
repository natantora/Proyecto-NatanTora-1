import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin-bootstrap";
import { canEditGallery, canPromoteUsers, type Role } from "@/lib/permissions";
import { readGallery } from "@/lib/gallery-server";
import GalleryAdmin from "./GalleryAdmin";
import GallerySetup from "./GallerySetup";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/gallery");
  const role = (await getUserRole(user.id)) as Role;
  if (!canEditGallery(role)) redirect("/admin/dashboard?error=no_access");

  const state = await readGallery();

  return (
    <div className="space-y-10">
      <div>
        <div className="eyebrow eyebrow-line text-gold mb-4">Galería</div>
        <h1 className="serif-display text-navy">
          Fotos del <em>Midrash</em>
        </h1>
        <p className="text-[14px] text-ink-soft mt-3 max-w-2xl leading-relaxed">
          Sube fotos desde el iPhone para mostrarlas en la galería pública.
          Las fotos se publican directamente al subir.
        </p>
      </div>

      {state.ok ? (
        <GalleryAdmin initialPhotos={state.photos} />
      ) : state.reason === "no_bucket" ? (
        canPromoteUsers(role) ? (
          <GallerySetup />
        ) : (
          <div className="border border-line bg-cream-light p-8">
            <p className="text-[14px] text-ink">
              El almacenamiento de fotos aún no está inicializado. Avísale a
              un propietario para que lo configure (una sola vez).
            </p>
          </div>
        )
      ) : (
        <div className="border border-red-200 bg-red-50 p-6">
          <p className="text-[14px] text-red-800">
            Error al cargar la galería: {state.message}
          </p>
        </div>
      )}
    </div>
  );
}
