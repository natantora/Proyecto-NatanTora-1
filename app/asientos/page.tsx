import Link from "next/link";
import { Calendar, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AsientosPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Buscar holiday actualmente abierto (is_open=true y dentro de la ventana)
  const { data: openHolidays } = await supabase
    .from("seat_holidays")
    .select("*")
    .eq("is_open", true)
    .or(`closes_at.is.null,closes_at.gte.${now}`)
    .order("starts_at", { ascending: true });

  const hasOpen = openHolidays && openHolidays.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-gold-bright font-serif text-4xl md:text-5xl text-center mb-3">
        Lugares para fiestas mayores
      </h1>
      <div className="divider-gold w-32 mx-auto mb-12" />

      {!hasOpen ? (
        <div className="card-elegant text-center py-12">
          <Bell className="w-12 h-12 text-gold mx-auto mb-6" />
          <h2 className="text-gold-bright font-serif text-2xl mb-4">
            Reservaciones cerradas por ahora
          </h2>
          <p className="text-cream-dim leading-relaxed max-w-xl mx-auto mb-6">
            La venta de asientos del Midrash se abre únicamente para las fiestas mayores: <strong className="text-cream">Rosh Hashaná</strong> y <strong className="text-cream">Kippur</strong>.
            Te avisaremos por correo cuando comience la venta.
          </p>
          <p className="text-cream-dim text-sm">
            Para recibir el aviso, asegúrate de estar registrado.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Link href="/auth/registro" className="btn-primary">Registrarse</Link>
            <Link href="/contacto" className="btn-outline">Contacto</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {openHolidays.map((h: any) => (
            <Link
              key={h.id}
              href={`/asientos/${h.slug}`}
              className="card-elegant block group"
            >
              <div className="flex items-start gap-4">
                <Calendar className="w-6 h-6 text-gold mt-1 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-gold-bright font-serif text-2xl mb-1 group-hover:text-gold-bright">
                    {h.name}
                  </h3>
                  {h.description && (
                    <p className="text-cream-dim text-sm leading-relaxed mb-3">
                      {h.description}
                    </p>
                  )}
                  <p className="text-gold-soft text-sm">Ver lugares disponibles →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
