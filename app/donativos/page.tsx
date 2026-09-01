import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DonationForm from "./DonationForm";
import { mercadoPagoConfigured } from "@/lib/mercado-pago";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donativos — Midrash Natán Torá", description: "Apoya las clases, becas y proyectos del Midrash Natán Torá." };

export default async function Donativos({ searchParams }: { searchParams: Promise<{ payment?: string; session_id?: string; internal_payment_id?: string; payment_id?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/donativos");
  if (user.status !== "approved") redirect("/auth/pendiente");
  const usesMercadoPago = mercadoPagoConfigured();
  const paymentResult = params.payment === "success" ? "success" : params.payment === "cancelled" ? "cancelled" : null;
  return <>
    <section className="relative overflow-hidden bg-navy-deep px-6 py-20 text-cream lg:py-24"><div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(#2A3A60 1px, transparent 1px), linear-gradient(90deg, #2A3A60 1px, transparent 1px)", backgroundSize: "80px 80px" }} /><div className="relative mx-auto max-w-5xl"><div className="eyebrow eyebrow-line mb-6 text-gold-light">Apoyo</div><h1 className="display-lg">Apoya el <span className="accent-light">Midrash.</span></h1><p className="mt-5 max-w-2xl text-[17px] text-cream/75">Tu donativo sostiene clases, becas, libros, eventos y el espacio de nuestra comunidad.</p></div></section>
    <section className="px-4 py-14 sm:px-6 sm:py-20"><div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]"><DonationForm paymentResult={paymentResult} sessionId={params.session_id || null} internalPaymentId={params.internal_payment_id || null} providerPaymentId={params.payment_id || null} enabled={usesMercadoPago || stripeConfigured()} providerName={usesMercadoPago ? "Mercado Pago" : "Stripe"} /><aside className="space-y-4"><div className="border border-line bg-white p-6"><h2 className="font-serif text-2xl font-bold text-navy">Tu apoyo se convierte en</h2><ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft"><li>• Clases y becas de estudio.</li><li>• Libros y material para la comunidad.</li><li>• Mantenimiento del Hejal y del espacio.</li><li>• Eventos y actividades comunitarias.</li></ul></div><div className="border border-gold/40 bg-gold/10 p-6 text-sm leading-relaxed text-ink-soft"><strong className="text-navy">Pago seguro:</strong> el donativo se procesa una sola vez en {usesMercadoPago ? "Mercado Pago" : "Stripe"} y recibirás confirmación por correo.</div></aside></div></section>
  </>;
}
