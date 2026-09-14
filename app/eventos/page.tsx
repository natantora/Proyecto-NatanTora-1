import Link from "next/link";
import { createAdminClient } from "@/lib/data/server";

export const metadata = {
  title: "Eventos — Midrash Natán Torá",
  description:
    "Eventos comunitarios, cenas, fiestas mayores e inscripciones del Midrash Natán Torá.",
};

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  seating_mode: "none" | "open" | "assigned" | "general";
  capacity: number | null;
  reservations_open: boolean;
  seat_price: number | string;
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

export default async function Eventos() {
  const db = createAdminClient();
  const { data: { user } } = await db.auth.getUser();
  const isLoggedIn = !!user;
  const { data, error } = await db
    .from("events")
    .select("id,title,description,event_date,location,seating_mode,capacity,reservations_open,seat_price")
    .eq("published", true)
    .order("event_date", { ascending: true });

  const now = new Date();
  const events = (data ?? []) as EventRow[];
  const upcoming = events.filter((event) => new Date(event.event_date) >= now);
  const past = events
    .filter((event) => new Date(event.event_date) < now)
    .sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
    );

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
          <div className="eyebrow eyebrow-line text-gold-light mb-6">Eventos</div>
          <h1 className="display-lg">
            Agenda de la <span className="accent-light">comunidad.</span>
          </h1>
          <p className="mt-5 text-[17px] text-cream/75 max-w-2xl">
            Consulta los próximos encuentros. Algunos eventos permiten comprar
            entradas sin registro y otros incluyen reservación de lugar.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 lg:py-24 bg-cream">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <div className="eyebrow eyebrow-line text-gold mb-4">Próximos eventos</div>
            <h2 className="display-md text-navy">Qué viene en el Midrash</h2>
          </div>

          {error ? (
            <div className="border border-line bg-cream-light p-6 text-[14px] text-ink-soft">
              No fue posible cargar la agenda en este momento. Intenta de nuevo
              más tarde.
            </div>
          ) : upcoming.length === 0 ? (
            <div className="border border-line bg-cream-light p-8 text-center">
              <p className="text-[15px] text-ink-soft">
                No hay próximos eventos publicados por el momento.
              </p>
            </div>
          ) : (
            <div className="bg-navy">
              <ul className="divide-y divide-navy-soft">
                {upcoming.map((event) => {
                  const date = new Date(event.event_date);
                  const parts = dateFormatter.formatToParts(date);
                  const day = parts.find((part) => part.type === "day")?.value;
                  const month = parts.find((part) => part.type === "month")?.value;
                  const year = parts.find((part) => part.type === "year")?.value;
                  const action = event.seating_mode === "assigned"
                    ? event.reservations_open ? "Elegir lugar" : "Próximamente"
                    : event.seating_mode === "open"
                      ? event.reservations_open ? "Reservar" : "Próximamente"
                      : event.seating_mode === "general"
                        ? event.reservations_open ? "Comprar entradas" : "Próximamente"
                      : "Ver evento";
                  return (
                    <li
                      key={event.id}
                      className="p-7 lg:p-9 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 md:gap-10 items-center transition-colors hover:bg-[#14213d]"
                    >
                      <div className="md:text-center md:pr-8 md:border-r border-navy-soft md:min-w-[110px]">
                        <div className="text-[40px] lg:text-[44px] font-bold text-gold-light leading-none">
                          {day}
                        </div>
                        <div className="text-[10px] tracking-[0.22em] uppercase text-cream/60 mt-2">
                          {month} {year}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[17px] text-cream font-bold uppercase tracking-wide mb-1.5">
                          {event.title}
                        </h3>
                        <div className="text-[13px] text-cream/65">
                          {timeFormatter.format(date)} · {event.location || "Midrash Natán Torá"}
                        </div>
                        {event.description ? (
                          <p className="text-[12px] text-gold-light mt-2 leading-relaxed">
                            {event.description}
                          </p>
                        ) : null}
                        {event.seating_mode !== "none" ? (
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/55">
                            {event.seating_mode === "assigned" ? <>Selección en plano · {event.capacity} lugares · Precios según asiento</> : event.seating_mode === "open" ? <>Lugar libre · {event.capacity} lugares{Number(event.seat_price) > 0 ? ` · $${Number(event.seat_price).toLocaleString("es-MX")} MXN` : " · Gratuito"}</> : <>Entrada general · ${Number(event.seat_price).toLocaleString("es-MX")} MXN por persona · Sin registro</>}
                          </p>
                        ) : null}
                      </div>
                      {event.seating_mode !== "none" && !event.reservations_open ? (
                        <span className="cursor-not-allowed whitespace-nowrap border border-cream/20 px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-cream/40">{action}</span>
                      ) : (
                        <Link
                          href={isLoggedIn || event.seating_mode === "general" ? `/eventos/${event.id}` : `/auth/login?next=${encodeURIComponent(`/eventos/${event.id}`)}`}
                          className="text-[11px] tracking-[0.2em] uppercase text-gold-light border border-gold/40 px-5 py-3 hover:bg-gold hover:text-navy-deep hover:border-gold transition-colors whitespace-nowrap"
                        >
                          {isLoggedIn || event.seating_mode === "general" ? action : "Inscribirme"}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-20 bg-cream-dark">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <div className="eyebrow eyebrow-line text-gold mb-4">Historial</div>
            <h2 className="display-md text-navy">Eventos pasados</h2>
            <p className="mt-3 text-[16px] text-ink-soft max-w-xl">
              Un registro de los momentos que hemos compartido como comunidad.
            </p>
          </div>
          {past.length === 0 ? (
            <p className="text-[14px] text-ink-muted italic">
              Todavía no hay eventos en el historial.
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border border-line">
              {past.map((event) => (
                <li
                  key={event.id}
                  className="bg-cream-light p-6 lg:p-7 flex justify-between gap-6 items-center"
                >
                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-gold mb-1">
                      {dateFormatter.format(new Date(event.event_date))}
                    </div>
                    <div className="text-[16px] text-navy font-medium">
                      {event.title}
                    </div>
                  </div>
                  <Link
                    href="/galeria"
                    className="shrink-0 text-[11px] tracking-[0.15em] uppercase text-ink-muted hover:text-gold"
                  >
                    Galería →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
