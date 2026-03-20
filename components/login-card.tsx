"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LockKeyhole, Mail } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { LoadingButton } from "@/components/ui";

export function LoginCard({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("El login real necesita configurar Supabase primero.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    setLoading(false);
  }

  return (
    <div className="panel mx-auto max-w-md px-6 py-8">
      <div className="mb-6 space-y-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-600">
          Acceso seguro
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-11"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="mozo@restaurante.com"
              required
            />
          </div>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Contraseña</span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-11"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </label>
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}
        <LoadingButton type="submit" loading={loading} className="w-full">
          Ingresar
        </LoadingButton>
      </form>
    </div>
  );
}
