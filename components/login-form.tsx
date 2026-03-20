"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Mail } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  title: string;
  subtitle: string;
  redirectTo: "/waiter" | "/admin";
}

export function LoginForm({ title, subtitle, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="panel mx-auto max-w-md p-6 sm:p-8">
      <div className="mb-8 space-y-3">
        <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-700">
          Acceso seguro
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-11"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="equipo@restaurant.com"
              required
            />
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-11"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </label>

        <button className="button-primary w-full gap-2" disabled={loading} type="submit">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Ingresar
        </button>

        <p
          className={cn(
            "min-h-5 text-sm",
            error ? "text-rose-600" : "text-transparent"
          )}
        >
          {error ?? "ok"}
        </p>
      </form>
    </div>
  );
}
