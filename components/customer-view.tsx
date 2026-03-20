"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, LoaderCircle, Receipt, WifiOff } from "lucide-react";

import { ACTION_LABELS, EVENT_COOLDOWN_MS } from "@/lib/constants";
import type { EventAction } from "@/lib/types";

const EMAIL_KEY = "mesa-lista.email";
const SESSION_KEY = "mesa-lista.session-id";
const COOLDOWN_PREFIX = "mesa-lista.cooldown";

function getOrCreateSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, nextValue);
  return nextValue;
}

export function CustomerView({
  tableId,
  tableName,
  restaurantName,
  primaryUrl
}: {
  tableId: string;
  tableName: string;
  restaurantName: string;
  primaryUrl: string | null;
}) {
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<EventAction | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    const storedEmail = window.localStorage.getItem(EMAIL_KEY);
    if (storedEmail) {
      setEmail(storedEmail);
    }
    setSessionId(getOrCreateSessionId());
    setIsOffline(!navigator.onLine);

    function syncOnlineState() {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCooldowns((current) => {
        const nextEntries = Object.entries(current).filter(([, value]) => value > Date.now());
        return Object.fromEntries(nextEntries);
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const actions: EventAction[] = useMemo(() => ["CALL_WAITER", "REQUEST_BILL"], []);

  function getCooldownKey(action: EventAction) {
    return `${COOLDOWN_PREFIX}:${tableId}:${sessionId}:${action}`;
  }

  function readCooldown(action: EventAction) {
    const value = window.localStorage.getItem(getCooldownKey(action));
    return value ? Number(value) : 0;
  }

  function writeCooldown(action: EventAction, nextValue: number) {
    window.localStorage.setItem(getCooldownKey(action), String(nextValue));
    setCooldowns((current) => ({
      ...current,
      [action]: nextValue
    }));
  }

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const initial = Object.fromEntries(actions.map((action) => [action, readCooldown(action)]));
    setCooldowns(initial);
  }, [actions, sessionId]);

  async function submitAction(action: EventAction) {
    setError(null);
    setStatus(null);

    if (isOffline) {
      setError("No hay conexión. Cuando vuelvas a estar online, podés intentar de nuevo.");
      return;
    }

    const nextCooldown = cooldowns[action];
    if (nextCooldown && nextCooldown > Date.now()) {
      const seconds = Math.ceil((nextCooldown - Date.now()) / 1000);
      setError(`Esperá ${seconds}s antes de volver a ${ACTION_LABELS[action].toLowerCase()}.`);
      return;
    }

    setLoadingAction(action);
    window.localStorage.setItem(EMAIL_KEY, email);

    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tableId,
        action,
        email,
        marketingOptIn,
        sessionId
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No se pudo registrar el pedido.");
      setLoadingAction(null);
      return;
    }

    const cooldownUntil = Date.now() + EVENT_COOLDOWN_MS;
    writeCooldown(action, cooldownUntil);
    setStatus(payload.message ?? "Listo, ya avisamos al equipo.");
    setLoadingAction(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="panel px-6 py-8 sm:px-8">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-700">
            Experiencia cliente
          </div>
          <div>
            <p className="text-sm text-slate-500">{restaurantName}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">{tableName}</h1>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-600">
            Usá el acceso rápido para abrir el pedido externo del restaurante o pedir ayuda
            sin esperar a que alguien pase por la mesa.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <a
            href={primaryUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="button-primary w-full"
            aria-disabled={!primaryUrl}
          >
            Ver menú / Hacer pedido
          </a>

          <div className="grid gap-3 sm:grid-cols-2">
            {actions.map((action) => {
              const seconds = Math.max(
                0,
                Math.ceil(((cooldowns[action] ?? 0) - Date.now()) / 1000)
              );

              return (
                <button
                  key={action}
                  className="button-secondary min-h-16 flex-col gap-1 text-left"
                  disabled={loadingAction !== null || seconds > 0}
                  onClick={() => submitAction(action)}
                >
                  <span>{ACTION_LABELS[action]}</span>
                  <span className="text-xs font-normal text-slate-500">
                    {seconds > 0 ? `Disponible en ${seconds}s` : "Aviso instantáneo al salón"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel px-6 py-8 sm:px-8">
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Antes de continuar</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Te pedimos un email para poder asociar el evento a la mesa y validar el cooldown.
            </p>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              className="input"
              placeholder="vos@ejemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              checked={marketingOptIn}
              onChange={(event) => setMarketingOptIn(event.target.checked)}
            />
            <span className="text-sm leading-6 text-slate-600">
              Quiero recibir novedades y promos del restaurante.
            </span>
          </label>

          {isOffline ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <div className="flex items-start gap-2">
                <WifiOff className="mt-0.5 h-4 w-4" />
                <span>Sin conexión. El envío se habilita automáticamente al volver online.</span>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          {status ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {status}
            </div>
          ) : null}

          {loadingAction ? (
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Registrando {ACTION_LABELS[loadingAction].toLowerCase()}...
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            <div className="flex items-start gap-2">
              <Receipt className="mt-0.5 h-4 w-4 text-slate-400" />
              <span>
                Cada acción tiene una espera de 60 segundos por mesa y sesión para evitar
                duplicados.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
