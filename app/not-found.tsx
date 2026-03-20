import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <div className="panel mx-auto max-w-xl px-6 py-12 text-center sm:px-8">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-700">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Mesa no encontrada
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Revisá el QR o volvé al inicio para entrar al panel correcto.
        </p>
        <Link href="/" className="button-primary mt-6">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
