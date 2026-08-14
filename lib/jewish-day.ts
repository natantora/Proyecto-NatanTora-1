// Hebcal API wrapper para fecha hebrea, parashá, Sefirat HaOmer
// y la inserción estacional de la Amidá.

export interface JewishDay {
  hebrewDate: string; // "26 Iyar 5786"
  parashaTitle: string; // "Parashat Bemidbar"
  omerDay: number | null; // 1-49 o null si no estamos en el Omer
  amidahInsert: "morid_hatal" | "mashiv_haruach"; // qué se inserta en Birkat Geburot
  amidahInsertLabel: string; // "Morid HaTal" / "Mashiv HaRuaj"
  isShabat: boolean;
  isYomTov: boolean;
  isRoshChodesh: boolean;
}

interface HebcalItem {
  title?: string;
  hebrew?: string;
  hdate?: string;
  category?: string;
  subcat?: string;
  date?: string;
  yomtov?: boolean;
}

function fmtYMD(d: Date, offsetMs: number): string {
  // YYYY-MM-DD en hora local CDMX
  const local = new Date(d.getTime() - offsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Determina si se inserta "Morid HaTal" o "Mashiv HaRuaj" en la Amidá.
 *
 * Minhag sefardí (incluyendo Halabi):
 *   - Mashiv HaRuaj umorid hagueshem: desde Musaf de Sheminí Atzeret
 *     hasta Shajarit del primer día de Pesaj.
 *   - Morid HaTal: desde Musaf de Pesaj hasta Shajarit de Sheminí Atzeret.
 *
 * Aproximación gregoriana razonable:
 *   - Mashiv HaRuaj: octubre/noviembre hasta finales de marzo / inicios de abril
 *   - Morid HaTal: resto del año.
 *
 * Para mayor precisión usaríamos la fecha hebrea exacta; aquí usamos heurística
 * basada en mes gregoriano (suficientemente preciso casi todo el año).
 */
function determineAmidahInsert(
  date: Date,
  hebrewDate: string
): JewishDay["amidahInsert"] {
  // Si tenemos fecha hebrea, intentamos detectar Tishri 22 a Nisan 15
  // hebrewDate viene como "26 Iyar 5786" o similar
  const months = [
    "Tishrei",
    "Cheshvan",
    "Marcheshvan",
    "Kislev",
    "Tevet",
    "Shevat",
    "Adar",
    "Adar I",
    "Adar II",
    "Nisan",
    "Iyar",
    "Iyyar",
    "Sivan",
    "Tamuz",
    "Av",
    "Elul",
  ];
  const hd = (hebrewDate || "").toLowerCase();
  // Iyar/Sivan/Tamuz/Av/Elul/Nisan(después Pesaj) = Morid HaTal
  if (
    hd.includes("iyar") ||
    hd.includes("iyyar") ||
    hd.includes("sivan") ||
    hd.includes("tamuz") ||
    hd.includes("av") ||
    hd.includes("elul")
  ) {
    return "morid_hatal";
  }
  // Cheshvan/Kislev/Tevet/Shevat/Adar = Mashiv HaRuaj
  if (
    hd.includes("cheshvan") ||
    hd.includes("marcheshvan") ||
    hd.includes("kislev") ||
    hd.includes("tevet") ||
    hd.includes("shevat") ||
    hd.includes("adar")
  ) {
    return "mashiv_haruach";
  }
  // Tishrei y Nisan necesitan el día exacto; aproximamos por mes gregoriano
  const month = date.getMonth(); // 0=enero
  // De abril (3) a inicios de octubre (9) = Morid HaTal
  if (month >= 3 && month <= 9) return "morid_hatal";
  return "mashiv_haruach";
}

/**
 * Llama a la API de Hebcal y devuelve la información del día judío.
 */
export async function fetchJewishDay(now: Date = new Date()): Promise<JewishDay> {
  const CDMX_OFFSET_MS = 6 * 60 * 60 * 1000;
  const ymd = fmtYMD(now, CDMX_OFFSET_MS);

  // También necesitamos el sábado siguiente para la parashá de la semana
  const local = new Date(now.getTime() - CDMX_OFFSET_MS);
  const dayOfWeek = local.getUTCDay(); // 0=domingo, 6=sábado
  const daysToSat = (6 - dayOfWeek + 7) % 7;
  const saturday = new Date(local);
  saturday.setUTCDate(saturday.getUTCDate() + daysToSat);
  const satYmd = fmtYMD(
    new Date(saturday.getTime() + CDMX_OFFSET_MS),
    CDMX_OFFSET_MS
  );

  let hebrewDate = "";
  let parashaTitle = "Parashá de la semana";
  let omerDay: number | null = null;
  let isShabat = dayOfWeek === 6;
  let isYomTov = false;
  let isRoshChodesh = false;

  // Llamada 1: día actual con omer + maj + min + rosh chodesh
  try {
    const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&mod=on&nx=on&omer=on&ss=off&i=off&lg=es&start=${ymd}&end=${ymd}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const items: HebcalItem[] = data.items ?? [];
      for (const it of items) {
        if (it.category === "hebdate") {
          hebrewDate = it.hebrew || it.title || "";
        }
        if (it.category === "omer") {
          // title viene como "1st day of the Omer" o "41 día de la Omer" en es
          // Hebcal usa "X. day of the Omer" en inglés; en es es similar
          const m = (it.title || "").match(/(\d+)/);
          if (m) omerDay = parseInt(m[1], 10);
        }
        if (it.category === "roshchodesh") {
          isRoshChodesh = true;
        }
        if (it.yomtov || it.category === "holiday") {
          isYomTov = true;
        }
      }
    }
  } catch {
    // sin red, dejamos valores por defecto
  }

  // Llamada 2: parashá del sábado siguiente
  try {
    const url = `https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&nx=off&mf=off&ss=on&mod=off&s=on&i=off&lg=es&start=${satYmd}&end=${satYmd}`;
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (res.ok) {
      const data = await res.json();
      const items: HebcalItem[] = data.items ?? [];
      const parasha = items.find((it) => it.category === "parashat");
      if (parasha?.title) {
        parashaTitle = parasha.title;
      }
    }
  } catch {
    // dejamos default
  }

  // Si Hebcal no nos dió fecha hebrea, intentamos extraerla de la respuesta /converter
  if (!hebrewDate) {
    try {
      const url = `https://www.hebcal.com/converter?cfg=json&date=${ymd}&g2h=1&strict=1`;
      const res = await fetch(url, { next: { revalidate: 21600 } });
      if (res.ok) {
        const data = await res.json();
        if (data.hd && data.hm && data.hy) {
          hebrewDate = `${data.hd} ${data.hm} ${data.hy}`;
        }
      }
    } catch {
      // ignore
    }
  }

  const amidahInsert = determineAmidahInsert(now, hebrewDate);
  const amidahInsertLabel =
    amidahInsert === "morid_hatal" ? "Morid HaTal" : "Mashiv HaRuaj";

  return {
    hebrewDate,
    parashaTitle,
    omerDay,
    amidahInsert,
    amidahInsertLabel,
    isShabat,
    isYomTov,
    isRoshChodesh,
  };
}
