"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  const printPlan = () => {
    const printingClass = "seat-plan-printing";
    const cleanup = () => document.body.classList.remove(printingClass);

    document.body.classList.add(printingClass);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  };

  return <button type="button" onClick={printPlan} className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold-light"><Printer size={17} /> Imprimir / guardar PDF</button>;
}
