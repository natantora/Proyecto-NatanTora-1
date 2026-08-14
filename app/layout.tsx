import type { Metadata } from "next";
import {
  Montserrat,
  Frank_Ruhl_Libre,
  Cormorant_Garamond,
} from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/Header";
import SiteFooter from "@/components/Footer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

const hebrew = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-hebrew",
  display: "swap",
});

// Cormorant Garamond — serif editorial display
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Midrash Natán Torá — Plaza Polanco, CDMX",
  description:
    "Centro de estudio y oración de la comunidad judía sefardí en Plaza Polanco, Ciudad de México. Clases diarias de Torá, rezos, eventos comunitarios bajo el minhag Halabi.",
  openGraph: {
    title: "Midrash Natán Torá",
    description: "Plaza Polanco · Ciudad de México",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary",
    title: "Midrash Natán Torá",
    description: "Plaza Polanco · Ciudad de México",
  },
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${hebrew.variable} ${serif.variable}`}
    >
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
