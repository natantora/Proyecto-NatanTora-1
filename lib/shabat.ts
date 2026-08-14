// Calculo de Shabat usando la API publica de Hebcal.
// Minhag Halabi (Shulhan haMelej de Halab) en Ciudad de Mexico:
//   - Encendido de velas: 20 min antes del shkia (puesta del sol)
//   - Havdala: 30 min despues del shkia (estrellas medias)
// Hebcal nos devuelve la parasha correcta y los horarios automaticos.

export type ShabatInfo = {
  candles: Date;        // Encendido de velas
  havdalah: Date;       // Havdala
  shkia: Date;          // Puesta del sol (calculado: candles + 20 min)
  parasha: string;      // Ej: "Behar", "Bereshit"
  parashaHebrew?: string;
  hebrewDate?: string;  // Ej: "23 Iyyar 5786"
  isShabat: boolean;    // true si hoy es viernes/sabado de la semana en curso
  shabatStart: Date;    // Inicio de Shabat (== candles)
  shabatEnd: Date;      // Salida de Shabat (== havdalah)
  city: string;
  minhag: string;
};

const CDMX_GEONAME_ID = 3530597;
const CANDLE_OFFSET_MIN = 20;
const HAVDALAH_OFFSET_MIN = 30;
const HEBCAL_URL = `https://www.hebcal.com/shabbat?cfg=json&geonameid=${CDMX_GEONAME_ID}&M=on&b=${CANDLE_OFFSET_MIN}&m=${HAVDALAH_OFFSET_MIN}`;

// Cache simple en memoria (TTL 1 hora). Se renueva cada que el server reinicia.
let cache: { data: ShabatInfo; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getShabatInfo(): Promise<ShabatInfo> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  try {
    const res = await fetch(HEBCAL_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error("Hebcal API error: " + res.status);
    const json = await res.json();

    const items: any[] = json.items ?? [];
    const candleItem = items.find((i) => i.category === "candles");
    const havdalahItem = items.find((i) => i.category === "havdalah");
    const parashaItem = items.find((i) => i.category === "parashat");
    const hebrewDateItem = items.find((i) => i.category === "hebdate");

    if (!candleItem || !havdalahItem) {
      throw new Error("Missing candle or havdalah from Hebcal response");
    }

    const candles = new Date(candleItem.date);
    const havdalah = new Date(havdalahItem.date);
    const shkia = new Date(candles.getTime() + CANDLE_OFFSET_MIN * 60 * 1000);

    const now = new Date();
    const isShabat = now >= candles && now <= havdalah;

    const parashaTitle: string = parashaItem?.title ?? "";
    // Hebcal returns titles like "Parashat Behar" — extract the parasha name
    const parasha = parashaTitle.replace(/^Parashat\s+/i, "").trim();
    const parashaHebrew = parashaItem?.hebrew;
    const hebrewDate = hebrewDateItem?.hebrew ?? hebrewDateItem?.title;

    const data: ShabatInfo = {
      candles,
      havdalah,
      shkia,
      parasha,
      parashaHebrew,
      hebrewDate,
      isShabat,
      shabatStart: candles,
      shabatEnd: havdalah,
      city: "Ciudad de Mexico",
      minhag: "Halabi (Shulhan haMelej de Halab)",
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  } catch (err) {
    console.error("getShabatInfo error:", err);
    // Fallback: devolvemos un objeto vacio con valores razonables.
    const now = new Date();
    return {
      candles: now,
      havdalah: now,
      shkia: now,
      parasha: "",
      isShabat: false,
      shabatStart: now,
      shabatEnd: now,
      city: "Ciudad de Mexico",
      minhag: "Halabi (Shulhan haMelej de Halab)",
    };
  }
}

// Util para formatear horas en zona CDMX.
export function formatTimeMexico(d: Date): string {
  return d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  });
}

export function formatDateMexico(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  });
}
