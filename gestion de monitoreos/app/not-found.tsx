import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003087] to-[#0066CC] flex items-center justify-center p-4">
      <div className="text-center space-y-5">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-2">
          <span className="text-white text-4xl font-black">404</span>
        </div>
        <h1 className="text-white text-2xl font-bold">Página no encontrada</h1>
        <p className="text-blue-200 text-sm max-w-xs mx-auto">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-white text-[#003087] px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-50 transition"
        >
          Volver al dashboard
        </Link>
      </div>
    </div>
  );
}
