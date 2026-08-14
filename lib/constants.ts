export const SITE_NAME = "Midrash Natán Torá";
export const SITE_LOCATION = "Plaza Polanco, Ciudad de México";
export const SITE_EMAIL = "info@natantora.com";

export const SEAT_TIERS = {
  premium: { name: "Premium", price: 12000, color: "bg-gold-400", label: "Asientos preferenciales cerca del Arón HaKódesh" },
  preferente: { name: "Preferente", price: 8000, color: "bg-midrash-400", label: "Asientos en el sector medio del Midrash" },
  general: { name: "General", price: 5000, color: "bg-midrash-200", label: "Asientos generales con excelente vista" },
} as const;

export type SeatTier = keyof typeof SEAT_TIERS;

export const PRAYER_TIMES = [
  { name: "Shajarit", description: "Rezo de la mañana", days: "Domingo a Viernes", time: "7:00 AM", icon: "🕐" },
  { name: "Minjá", description: "Rezo de la tarde", days: "Domingo a Jueves", time: "1:30 PM", icon: "☀️" },
  { name: "Arvit", description: "Rezo de la noche", days: "Domingo a Jueves", time: "7:30 PM", icon: "🌙" },
];

export const DONATION_TIERS = [
  { slug: "amigo", name: "Amigo del Midrash", amount: 500, interval: "mes", description: "Contribuye al mantenimiento mensual del Midrash.", benefits: ["Nombre en el mural de donantes", "Boletín mensual"] },
  { slug: "socio", name: "Socio", amount: 1500, interval: "mes", description: "Apoya las clases y actividades educativas.", benefits: ["Acceso a clases grabadas", "Descuento en eventos", "Boletín exclusivo"], popular: true },
  { slug: "benefactor", name: "Benefactor", amount: 5000, interval: "mes", description: "Patrocina el crecimiento y las renovaciones del Midrash.", benefits: ["Placa conmemorativa", "Asiento preferente", "Invitación a eventos privados"] },
  { slug: "pilar", name: "Pilar de la Torá", amount: 10000, interval: "mes", description: "Sé un pilar fundamental de nuestra comunidad.", benefits: ["Todos los beneficios anteriores", "Reconocimiento especial en Shabat", "Consulta privada con el Rab"] },
];

export const ONE_TIME_DONATIONS = [
  { slug: "kidush", name: "Patrocinar un Kidush", amount: 3000, description: "Patrocina el Kidush del Shabat en honor a una ocasión especial." },
  { slug: "seuda", name: "Seudá Shelishit", amount: 2000, description: "Patrocina la tercera comida de Shabat." },
  { slug: "clase", name: "Dedicar una Clase", amount: 1800, description: "Dedica una clase de Torá en memoria o en honor de un ser querido." },
  { slug: "sefer", name: "Mantenimiento del Séfer Torá", amount: 5000, description: "Contribuye al mantenimiento y revisión de nuestros Sifrei Torá." },
];
