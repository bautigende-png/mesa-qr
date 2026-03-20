"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  ReceiptText,
  WifiOff
} from "lucide-react";

import { ACTION_LABELS, EVENT_COOLDOWN_MS } from "@/lib/constants";
import type { EventAction } from "@/lib/types";

const SESSION_KEY = "mesa-lista.session-id";
const EMAIL_KEY = "mesa-lista.customer-email";
const COOLDOWN_PREFIX = "mesa-lista.cooldown";

interface CustomerActionsProps {
  tableId: string;
  tableName: string;
  restaurantName: string;
  primaryUrl: string | null;
  menuUrl: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerText: string | null;
  customMessage: string | null;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
}

type FeedbackState =
  | { kind: "idle"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function CustomerActions({
  tableId,
  tableName,
  restaurantName,
  primaryUrl,
  menuUrl,
  logoUrl,
  bannerUrl,
  bannerText,
  customMessage,
  primaryColor,
  secondaryColor,
  tertiaryColor
}: CustomerActionsProps) {
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    kind: "idle",
    message: "Elegí una acción y te conectamos con el equipo del salón."
  });
  const [loadingAction, setLoadingAction] = useState<EventAction | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [cooldowns, setCooldowns] = useState<Record<EventAction, number>>({
    CALL_WAITER: 0,
    REQUEST_BILL: 0
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedEmail = window.localStorage.getItem(EMAIL_KEY);
    if (storedEmail) {
      setEmail(storedEmail);
    }

    const existingSession = window.localStorage.getItem(SESSION_KEY);
    if (existingSession) {
      setSessionId(existingSession);
    } else {
      const generated = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, generated);
      setSessionId(generated);
    }

    setIsOnline(navigator.onLine);

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const readCooldown = (action: EventAction) => {
      const stored = window.localStorage.getItem(
        `${COOLDOWN_PREFIX}:${tableId}:${sessionId}:${action}`
      );
      return stored ? Number(stored) : 0;
    };

    setCooldowns({
      CALL_WAITER: readCooldown("CALL_WAITER"),
      REQUEST_BILL: readCooldown("REQUEST_BILL")
    });

    const interval = window.setInterval(() => {
      setCooldowns((current) => ({
        CALL_WAITER: current.CALL_WAITER > Date.now() ? current.CALL_WAITER : 0,
        REQUEST_BILL: current.REQUEST_BILL > Date.now() ? current.REQUEST_BILL : 0
      }));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionId, tableId]);

  async function submitAction(action: EventAction) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFeedback({
        kind: "error",
        message: "Ingresá un email válido antes de enviar el aviso."
      });
      return;
    }

    if (!sessionId) {
      setFeedback({
        kind: "error",
        message: "No pudimos preparar tu sesión. Recargá la página e intentá otra vez."
      });
      return;
    }

    if (!isOnline) {
      setFeedback({
        kind: "error",
        message: "Parece que no hay conexión. Revisá internet y probá de nuevo."
      });
      return;
    }

    if (cooldowns[action] > Date.now()) {
      setFeedback({
        kind: "error",
        message: `Esperá ${Math.ceil((cooldowns[action] - Date.now()) / 1000)}s antes de volver a enviar esta acción.`
      });
      return;
    }

    setLoadingAction(action);
    setFeedback({ kind: "idle", message: "Enviando aviso al salón..." });

    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tableId,
        sessionId,
        action,
        customerEmail: normalizedEmail,
        marketingOptIn
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: string; retryAfterSeconds?: number }
      | null;

    if (!response.ok) {
      const retryAfter =
        payload?.retryAfterSeconds && payload.retryAfterSeconds > 0
          ? ` Esperá ${payload.retryAfterSeconds}s antes de volver a intentar.`
          : "";
      setFeedback({
        kind: "error",
        message: payload?.error ?? `No se pudo crear el evento.${retryAfter}`
      });
      setLoadingAction(null);
      return;
    }

    window.localStorage.setItem(EMAIL_KEY, normalizedEmail);
    const cooldownUntil = Date.now() + EVENT_COOLDOWN_MS;
    window.localStorage.setItem(
      `${COOLDOWN_PREFIX}:${tableId}:${sessionId}:${action}`,
      String(cooldownUntil)
    );
    setCooldowns((current) => ({ ...current, [action]: cooldownUntil }));
    setFeedback({
      kind: "success",
      message:
        payload?.message ??
        `${ACTION_LABELS[action]} enviado. El equipo ya recibió el aviso.`
    });
    setLoadingAction(null);
  }

  return (
    <main
      className="min-h-screen px-4 py-4 sm:px-6"
      style={{
        background: `linear-gradient(180deg, ${tertiaryColor} 0%, #ffffff 100%)`
      }}
    >
      <div className="mx-auto max-w-lg space-y-4">
        <section className="overflow-hidden rounded-[32px] border border-white/80 bg-white/92 shadow-soft backdrop-blur">
          <div
            className="px-5 pb-6 pt-5 text-white sm:px-8"
            style={{
              background: `linear-gradient(140deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-white/70">
                  {restaurantName}
                </div>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">{tableName}</h1>
              </div>
              {logoUrl ? (
                <div className="h-14 w-14 overflow-hidden rounded-[20px] border border-white/20 bg-white/10">
                  <img alt={`${restaurantName} logo`} className="h-full w-full object-cover" src={logoUrl} />
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-6 text-white/80">
              Interfaz pensada para celular. Abrí el menú, pedí directo o avisale al salón
              sin esperar.
            </p>

            {bannerUrl ? (
              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/15 bg-white/10">
                <img alt="Banner del restaurante" className="h-40 w-full object-cover" src={bannerUrl} />
                {bannerText ? (
                  <div className="px-4 py-3 text-sm font-medium text-white/90">{bannerText}</div>
                ) : null}
              </div>
            ) : bannerText ? (
              <div className="mt-5 rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 text-sm font-medium text-white/90">
                {bannerText}
              </div>
            ) : null}
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-8">
            {customMessage ? (
              <div
                className="rounded-[24px] border px-4 py-4 text-sm leading-6"
                style={{
                  backgroundColor: tertiaryColor,
                  borderColor: `${secondaryColor}33`,
                  color: primaryColor
                }}
              >
                {customMessage}
              </div>
            ) : null}

            <div className="grid gap-3">
              <a
                className={`button-primary h-14 gap-2 rounded-[20px] text-base ${!primaryUrl ? "pointer-events-none opacity-60" : ""}`}
                href={primaryUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!primaryUrl}
                style={{
                  backgroundColor: primaryColor,
                  color: "#ffffff"
                }}
              >
                Pedí directo
                <ExternalLink className="h-4 w-4" />
              </a>
              {!primaryUrl ? (
                <p className="text-sm text-rose-600">
                  Esta mesa todavía no tiene link de pedido configurado.
                </p>
              ) : null}

              <a
                className={`button-secondary h-14 gap-2 rounded-[20px] text-base ${!menuUrl ? "pointer-events-none opacity-60" : ""}`}
                href={menuUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!menuUrl}
                style={{
                  borderColor: `${primaryColor}22`,
                  color: primaryColor
                }}
              >
                Ver menú
                <ExternalLink className="h-4 w-4" />
              </a>
              {!menuUrl ? (
                <p className="text-sm text-rose-600">
                  Falta configurar el link del menú para esta marca.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Tu email para confirmar el pedido de ayuda
                </span>
                <input
                  className="input rounded-[20px]"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@email.com"
                  required
                />
              </label>

              <label className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                  checked={marketingOptIn}
                  onChange={(event) => setMarketingOptIn(event.target.checked)}
                />
                <span className="text-sm leading-6 text-slate-600">
                  Quiero recibir novedades, promociones y beneficios del restaurante.
                </span>
              </label>
            </div>

            {!isOnline ? (
              <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Sin conexión</p>
                  <p className="mt-1 text-sm leading-6">
                    El menú externo y los avisos al salón requieren internet.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="button-secondary h-14 gap-2 rounded-[20px] text-base"
                disabled={loadingAction !== null || cooldowns.CALL_WAITER > Date.now()}
                onClick={() => submitAction("CALL_WAITER")}
                style={{
                  borderColor: `${primaryColor}22`,
                  color: primaryColor
                }}
              >
                <Bell className="h-4 w-4" />
                {loadingAction === "CALL_WAITER"
                  ? "Enviando..."
                  : cooldowns.CALL_WAITER > Date.now()
                    ? `Disponible en ${Math.ceil((cooldowns.CALL_WAITER - Date.now()) / 1000)}s`
                    : "Llamar al mozo"}
              </button>

              <button
                className="button-secondary h-14 gap-2 rounded-[20px] text-base"
                disabled={loadingAction !== null || cooldowns.REQUEST_BILL > Date.now()}
                onClick={() => submitAction("REQUEST_BILL")}
                style={{
                  borderColor: `${secondaryColor}33`,
                  color: secondaryColor
                }}
              >
                <ReceiptText className="h-4 w-4" />
                {loadingAction === "REQUEST_BILL"
                  ? "Enviando..."
                  : cooldowns.REQUEST_BILL > Date.now()
                    ? `Disponible en ${Math.ceil((cooldowns.REQUEST_BILL - Date.now()) / 1000)}s`
                    : "Pedir la cuenta"}
              </button>
            </div>

            <div
              className={`flex items-start gap-3 rounded-[24px] px-4 py-4 text-sm leading-6 ${
                feedback.kind === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : feedback.kind === "error"
                    ? "border border-rose-200 bg-rose-50 text-rose-900"
                    : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {feedback.kind === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : feedback.kind === "error" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <Bell className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p>{feedback.message}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] opacity-70">
                  Cooldown anti-spam: {EVENT_COOLDOWN_MS / 1000}s por acción y mesa
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
