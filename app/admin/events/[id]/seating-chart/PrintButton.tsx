import { Download } from "lucide-react";

export default function PrintButton({ eventId }: { eventId: string }) {
  return <a
    href={`/api/admin/events/${eventId}/seating-chart/pdf`}
    className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold-light"
  ><Download size={17} /> Descargar PDF</a>;
}
