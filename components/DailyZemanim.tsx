import { computeZemanim, formatTimeCDMX, CDMX } from "@/lib/zemanim";
import { fetchJewishDay } from "@/lib/jewish-day";

export const revalidate = 3600; // 1 hora

const DIAS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Shabat",
];
const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatDateLocal(now: Date): string {
  const CDMX_OFFSET_MS = 6 * 60 * 60 * 1000;
  const cdmx = new Date(now.getTime() - CDMX_OFFSET_MS);
  return `${DIAS_ES[cdmx.getUTCDay()]} ${cdmx.getUTCDate()} de ${MESES_ES[cdmx.getUTCMonth()]} de ${cdmx.getUTCFullYear()}`;
}

export default async function DailyZemanim() {
  const now = new Date();
  const z = computeZemanim(now, CDMX.lat, CDMX.lng);
  const jd = await fetchJewishDay(now);

  // Agrupamos zemanim por momento del día
  const mananaItems = [
    { he: "עלות השחר", es: "Alot HaShajar", time: z.alotHashachar, hint: "Amanecer halajico" },
    { he: "משיכיר", es: "Misheyakir", time: z.misheyakir, hint: "Talit y tefilín" },
    { he: "הנץ החמה", es: "Salida del sol", time: z.hanetz, hint: "HaNetz" },
    { he: 'סוף זמן ק"ש מג"א', es: "Sof Zman Shemá (MGA)", time: z.sofZmanShemaMGA },
    { he: 'סוף זמן ק"ש גר"א', es: "Sof Zman Shemá (GRA)", time: z.sofZmanShemaGRA },
    { he: "סוף זמן ברכות שמע", es: "Sof Zman Birkot Shemá", time: z.sofZmanBirkhotShema },
  ];

  const tardeItems = [
    { he: "חצות היום", es: "Jatzot (mediodía)", time: z.chatzot },
    { he: "מנחה גדולה", es: "Minjá Guedolá", time: z.minchaGedolah },
    { he: "מנחה קטנה", es: "Minjá Ketaná", time: z.minchaKetanah },
    { he: "פלג המנחה", es: "Plag HaMinjá", time: z.plagHamincha },
  ];

  const nocheItems = [
    { he: "שקיעה", es: "Shkiá", time: z.shkia, hint: "Puesta del sol" },
    { he: "צאת הכוכבים", es: "Tzeit Hakojavim", time: z.tzeitHakokhavim, hint: "Salida de estrellas" },
    { he: "צאת (חומרא)", es: "Tzeit (Humrá)", time: z.tzeitHumra, hint: "+20 min" },
    { he: 'צאת ר"ת', es: "Tzeit Rabenu Tam", time: z.tzeitRabbeinuTam, hint: "+72 min" },
    { he: "חצות הלילה", es: "Jatzot Halaila", time: z.chatzotHalayla, hint: "Medianoche halajica" },
  ];

  return (
    <section className="relative bg-cream-light border-y border-line overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, #B8924A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-14 lg:py-20">
        {/* Encabezado */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end mb-12 lg:mb-16">
          <div className="lg:col-span-7">
            <div className="eyebrow eyebrow-line text-gold mb-5">
              Zemanim del día
            </div>
            <h2 className="serif-display text-navy">
              {jd.parashaTitle && jd.parashaTitle !== "Parashá de la semana" ? (
                <>
                  {jd.parashaTitle.replace(/^Parashat /, "")}
                  <span className="text-ink-muted"> · </span>
                  <em>{formatDateLocal(now)}</em>
                </>
              ) : (
                <>
                  Hoy en el <em>Midrash</em>
                </>
              )}
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pb-2">
            <div className="hairline mb-4" />
            <div className="text-[12px] tracking-[0.22em] uppercase text-ink-muted font-semibold leading-relaxed">
              {jd.hebrewDate && <div>{jd.hebrewDate}</div>}
              <div>Plaza Polanco · CDMX</div>
              <div>Minhag Halabi de Aram Tzobá</div>
            </div>
          </div>
        </div>

        {/* Grid de zemanim — 3 columnas en desktop, stack en mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-line border border-line">
          <ZemanimColumn title="Mañana" items={mananaItems} />
          <ZemanimColumn title="Tarde" items={tardeItems} />
          <ZemanimColumn title="Noche" items={nocheItems} />
        </div>

        {/* Tefilot del día — Omer, Amidá insert */}
        {(jd.omerDay || jd.amidahInsertLabel) && (
          <div className="mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-2 gap-px bg-line border border-line">
            <PrayerBlock
              he="שינוי בתפילה"
              es="Inserción en la Amidá"
              value={jd.amidahInsertLabel}
              hint={
                jd.amidahInsert === "morid_hatal"
                  ? "Birkat Guevurot — desde Pesaj"
                  : "Birkat Guevurot — desde Sheminí Atzeret"
              }
            />
            {jd.omerDay !== null && jd.omerDay >= 1 && jd.omerDay <= 49 && (
              <PrayerBlock
                he="ספירת העומר"
                es="Sefirat HaOmer"
                value={`Día ${jd.omerDay} de 49`}
                hint="Se cuenta en la noche, después de Arvit"
              />
            )}
          </div>
        )}

        <p className="mt-10 text-[12px] text-ink-muted leading-relaxed max-w-3xl">
          Cálculos halajicos para las coordenadas de Plaza Polanco (19.43°N,
          99.13°O), zona horaria UTC-6 (sin horario de verano). Para los
          horarios reales de los rezos en el Midrash —Shajarit, Minjá, Arvit—{" "}
          <span className="text-ink-soft">
            es necesario estar registrado y aprobado
          </span>
          .
        </p>
      </div>
    </section>
  );
}

function ZemanimColumn({
  title,
  items,
}: {
  title: string;
  items: { he: string; es: string; time: Date; hint?: string }[];
}) {
  return (
    <div className="bg-cream-light p-7 lg:p-9">
      <div className="text-[10px] tracking-[0.3em] uppercase text-gold-deep font-bold mb-6">
        — {title}
      </div>
      <ul className="space-y-5">
        {items.map((it) => (
          <li key={it.es} className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-navy leading-tight">
                {it.es}
              </div>
              <div className="font-hebrew text-[14px] text-ink-soft leading-tight mt-0.5">
                {it.he}
              </div>
              {it.hint && (
                <div className="text-[11px] text-ink-muted mt-1 tracking-wide">
                  {it.hint}
                </div>
              )}
            </div>
            <div className="font-serif text-[22px] lg:text-[26px] text-navy tabular-nums leading-none shrink-0">
              {formatTimeCDMX(it.time)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrayerBlock({
  he,
  es,
  value,
  hint,
}: {
  he: string;
  es: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-cream-light p-7 lg:p-9 flex items-baseline justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[10px] tracking-[0.28em] uppercase text-gold font-bold mb-2">
          {es}
        </div>
        <div className="font-hebrew text-[15px] text-ink-soft leading-tight">
          {he}
        </div>
        {hint && (
          <div className="text-[11px] text-ink-muted mt-2 tracking-wide leading-relaxed">
            {hint}
          </div>
        )}
      </div>
      <div className="font-serif text-[22px] lg:text-[26px] text-navy leading-none shrink-0 italic">
        {value}
      </div>
    </div>
  );
}
