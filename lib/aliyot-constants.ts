export const ALIYAH_READING_TYPES = ["Rosh Hodesh", "Lunes", "Jueves", "Shabat", "Fiesta"] as const;
export type AliyahReadingType = (typeof ALIYAH_READING_TYPES)[number];

export const PARASHOT = [
  "Bereshit", "Noaj", "Lej Lejá", "Vayerá", "Jayei Sará", "Toldot", "Vayetzé", "Vayishlaj", "Vayeshev", "Miketz", "Vayigash", "Vayejí",
  "Shemot", "Vaerá", "Bo", "Beshalaj", "Yitró", "Mishpatim", "Terumá", "Tetzavé", "Ki Tisá", "Vayakhel", "Pekudei", "Vayakhel–Pekudei",
  "Vayikrá", "Tzav", "Sheminí", "Tazría", "Metzorá", "Tazría–Metzorá", "Ajarei Mot", "Kedoshim", "Ajarei Mot–Kedoshim", "Emor", "Behar", "Bejukotai", "Behar–Bejukotai",
  "Bamidbar", "Nasó", "Behaalotejá", "Shelaj Lejá", "Koraj", "Jukat", "Balak", "Jukat–Balak", "Pinjás", "Matot", "Masei", "Matot–Masei",
  "Devarim", "Vaetjanán", "Ekev", "Reé", "Shoftim", "Ki Tetzé", "Ki Tavó", "Nitzavim", "Vayelej", "Nitzavim–Vayelej", "Haazinu", "Vezot Haberajá",
  "Lectura especial de Rosh Hodesh", "Lectura especial de fiesta",
] as const;
