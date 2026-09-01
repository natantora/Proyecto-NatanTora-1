"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold-light"><Printer size={17} /> Imprimir / guardar PDF</button>;
}
