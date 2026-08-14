import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="font-serif text-7xl font-bold text-gold-400">404</span>
      <h1 className="mt-4 font-serif text-3xl font-bold text-midrash-900">Página no encontrada</h1>
      <p className="mt-3 text-midrash-700">La página que buscas no existe o fue movida.</p>
      <Link href="/" className="btn-primary mt-8">Volver al inicio</Link>
    </div>
  );
}
