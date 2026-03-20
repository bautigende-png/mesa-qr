import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, UtensilsCrossed } from "lucide-react";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="panel overflow-hidden">
        <div className="grid gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-12">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-700">
              <Sparkles className="h-4 w-4" />
              MVP listo para deploy
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Mesa Lista centraliza llamados de mesa sin tocar tu sistema de pedidos.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Los clientes abren el menu externo del restaurante, y el equipo recibe
                alertas en tiempo real para mozo o cuenta desde una interfaz pensada para
                piso.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/waiter" className="button-primary gap-2">
                Panel mozo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin" className="button-secondary gap-2">
                Panel admin
                <ShieldCheck className="h-4 w-4" />
              </Link>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <UtensilsCrossed className="h-5 w-5 text-amber-300" />
              Flujo principal
            </div>
            <div className="mt-6 space-y-4">
              {[
                "Cliente escanea QR y entra a /t/[tableId]",
                "Abre menu externo o dispara evento de mesa",
                "Mozo recibe alerta en tiempo real",
                "Admin controla mesas, QR y usuarios"
              ].map((item, index) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                    Paso 0{index + 1}
                  </div>
                  <p className="text-sm text-slate-100">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
