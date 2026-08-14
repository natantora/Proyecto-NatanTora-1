import SunCalc from "suncalc";

// CDMX (Plaza Polanco area)
export const CDMX = { lat: 19.43, lng: -99.13 };

// CDMX uses UTC-6 year-round (Mexico dropped DST in 2022)
export const CDMX_OFFSET_MS = 6 * 60 * 60 * 1000;

export interface Zemanim {
  alotHashachar: Date; // Amanecer halajico (MGA 72 min)
  misheyakir: Date; // Sof Zman Talit/Tefilín (50 min antes del sol)
  hanetz: Date; // Salida del sol
  sofZmanShemaMGA: Date; // Sof Zman Shemá según Maguen Avraham
  sofZmanShemaGRA: Date; // Sof Zman Shemá según GRA / Shulján Aruj
  sofZmanBirkhotShema: Date; // Sof Zman para Birkot Shemá (4 sha'ot)
  sofZmanTefilaMGA: Date; // Sof Zman Tefilá MGA (4 sha'ot desde alot)
  sofZmanTefilaGRA: Date; // Sof Zman Tefilá GRA
  chatzot: Date; // Mediodía solar
  minchaGedolah: Date; // Minjá Guedolá (chatzot + 30 min zmaniyot)
  minchaKetanah: Date; // Minjá Ketaná (9.5 sha'ot)
  plagHamincha: Date; // Plag HaMinjá (10.75 sha'ot GRA)
  shkia: Date; // Puesta del sol
  tzeitHakokhavim: Date; // Salida de estrellas (shkia + 13 min)
  tzeitHumra: Date; // Tzeit Humrá (shkia + 20 min)
  tzeitRabbeinuTam: Date; // Tzeit Rabenu Tam (shkia + 72 min)
  chatzotHalayla: Date; // Medianoche halajica
  // Metadatos
  shaahZmanitGRA: number; // ms
  shaahZmanitMGA: number; // ms
}

/**
 * Calcula todos los zemanim halajicos para una fecha y ubicación.
 * Sigue el minhag general sefardí; refinamientos específicos del minhag
 * Halabi pueden añadirse después.
 */
export function computeZemanim(
  date: Date,
  lat: number = CDMX.lat,
  lng: number = CDMX.lng
): Zemanim {
  const times = SunCalc.getTimes(date, lat, lng);
  const sunrise = times.sunrise;
  const sunset = times.sunset;

  // Sha'ah zmanit GRA: 1/12 del día solar (amanecer → atardecer)
  const shaahZmanitGRA = (sunset.getTime() - sunrise.getTime()) / 12;

  // Alot HaShajar: 72 minutos fijos antes del amanecer (criterio MGA)
  const alotHashachar = new Date(sunrise.getTime() - 72 * 60_000);

  // Sha'ah zmanit MGA: 1/12 del "día extendido" (alot a tzeit Rabenu Tam)
  const shaahZmanitMGA =
    (sunset.getTime() + 72 * 60_000 - alotHashachar.getTime()) / 12;

  // Misheyakir: 50 min antes del sol (Halabi)
  const misheyakir = new Date(sunrise.getTime() - 50 * 60_000);

  // Sof Zman Shemá
  const sofZmanShemaMGA = new Date(
    alotHashachar.getTime() + 3 * shaahZmanitMGA
  );
  const sofZmanShemaGRA = new Date(sunrise.getTime() + 3 * shaahZmanitGRA);

  // Sof Zman Birkhot Shemá
  const sofZmanBirkhotShema = new Date(
    sunrise.getTime() + 4 * shaahZmanitGRA
  );

  // Sof Zman Tefilá
  const sofZmanTefilaMGA = new Date(
    alotHashachar.getTime() + 4 * shaahZmanitMGA
  );
  const sofZmanTefilaGRA = new Date(sunrise.getTime() + 4 * shaahZmanitGRA);

  // Chatzot (mediodía solar)
  const chatzot = new Date(sunrise.getTime() + 6 * shaahZmanitGRA);

  // Minjá Guedolá: chatzot + 0.5 sha'ah zmanit
  const minchaGedolah = new Date(chatzot.getTime() + 0.5 * shaahZmanitGRA);

  // Minjá Ketaná: 9.5 sha'ot desde el amanecer
  const minchaKetanah = new Date(sunrise.getTime() + 9.5 * shaahZmanitGRA);

  // Plag HaMinjá: 10.75 sha'ot desde el amanecer (criterio GRA / Halichot Olam)
  const plagHamincha = new Date(sunrise.getTime() + 10.75 * shaahZmanitGRA);

  // Shkiá
  const shkia = sunset;

  // Tzeit Hakojavim: shkia + 13 min (~3 estrellas medianas, Geonim)
  const tzeitHakokhavim = new Date(shkia.getTime() + 13 * 60_000);

  // Tzeit Humrá: shkia + 20 min (criterio estricto para Shabat/Yom Tov)
  const tzeitHumra = new Date(shkia.getTime() + 20 * 60_000);

  // Tzeit Rabenu Tam: shkia + 72 min
  const tzeitRabbeinuTam = new Date(shkia.getTime() + 72 * 60_000);

  // Jatzot Halaila: chatzot + 12 horas (medianoche halajica)
  const chatzotHalayla = new Date(chatzot.getTime() + 12 * 60 * 60_000);

  return {
    alotHashachar,
    misheyakir,
    hanetz: sunrise,
    sofZmanShemaMGA,
    sofZmanShemaGRA,
    sofZmanBirkhotShema,
    sofZmanTefilaMGA,
    sofZmanTefilaGRA,
    chatzot,
    minchaGedolah,
    minchaKetanah,
    plagHamincha,
    shkia,
    tzeitHakokhavim,
    tzeitHumra,
    tzeitRabbeinuTam,
    chatzotHalayla,
    shaahZmanitGRA,
    shaahZmanitMGA,
  };
}

/**
 * Formato HH:MM en hora local CDMX, robusto sin depender de ICU del runtime.
 */
export function formatTimeCDMX(d: Date): string {
  const cdmx = new Date(d.getTime() - CDMX_OFFSET_MS);
  const hh = String(cdmx.getUTCHours()).padStart(2, "0");
  const mm = String(cdmx.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
