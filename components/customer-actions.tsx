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
import { getReadableTextColor, mixHex, toRgba } from "@/lib/color-theme";
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
    REQUEST_BILL: 0,
    VIEW_MENU: 0
  });

  const heroBlend = mixHex(primaryColor, secondaryColor, 0.5);
  const heroTextColor = getReadableTextColor(heroBlend);
  const heroMutedTextColor = toRgba(heroTextColor, heroTextColor === "#ffffff" ? 0.78 : 0.72);
  const heroCardBackground = toRgba(heroTextColor === "#ffffff" ? "#ffffff" : primaryColor, 0.1);
  const primaryButtonTextColor = getReadableTextColor(primaryColor);
  const directButtonBackground = primaryColor;
  const menuButtonBackground = mixHex(primaryColor, tertiaryColor, 0.84);
  const menuButtonTextColor = getReadableTextColor(menuButtonBackground);
  const billButtonBackground = mixHex(secondaryColor, tertiaryColor, 0.82);
  const billButtonTextColor = getReadableTextColor(billButtonBackground);
  const customMessageBackground = mixHex(tertiaryColor, "#ffffff", 0.28);
  const customMessageTextColor = getReadableTextColor(customMessageBackground);

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
      REQUEST_BILL: readCooldown("REQUEST_BILL"),
      VIEW_MENU: readCooldown("VIEW_MENU")
    });

    const interval = window.setInterval(() => {
      setCooldowns((current) => ({
        CALL_WAITER: current.CALL_WAITER > Date.now() ? current.CALL_WAITER : 0,
        REQUEST_BILL: current.REQUEST_BILL > Date.now() ? current.REQUEST_BILL : 0,
        VIEW_MENU: current.VIEW_MENU > Date.now() ? current.VIEW_MENU : 0
      }));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionId, tableId]);

  function getOptionalCustomerEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFeedback({
        kind: "error",
        message: "El email ingresado no parece válido. Podés corregirlo o dejarlo vacío."
      });
      return null;
    }

    return normalizedEmail || "";
  }

  function validateSessionForAction() {
    if (!sessionId) {
      setFeedback({
        kind: "error",
        message: "No pudimos preparar tu sesión. Recargá la página e intentá otra vez."
      });
      return null;
    }

    if (!isOnline) {
      setFeedback({
        kind: "error",
        message: "Parece que no hay conexión. Revisá internet y probá de nuevo."
      });
      return null;
    }

    return getOptionalCustomerEmail();
  }

  async function submitAction(
    action: EventAction,
    options?: { silent?: boolean; successMessage?: string }
  ) {
    const normalizedEmail = validateSessionForAction();

    if (normalizedEmail === null) {
      return false;
    }

    if (cooldowns[action] > Date.now()) {
      if (!options?.silent) {
        setFeedback({
          kind: "error",
          message: `Esperá ${Math.ceil((cooldowns[action] - Date.now()) / 1000)}s antes de volver a enviar esta acción.`
        });
      }
      return false;
    }

    if (!options?.silent) {
      setLoadingAction(action);
      setFeedback({ kind: "idle", message: "Enviando aviso al salón..." });
    }

    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tableId,
        sessionId,
        action,
        customerEmail: normalizedEmail || null,
        marketingOptIn: normalizedEmail ? marketingOptIn : false
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
      if (!options?.silent) {
        setLoadingAction(null);
      }
      return false;
    }

    if (normalizedEmail) {
      window.localStorage.setItem(EMAIL_KEY, normalizedEmail);
    } else {
      window.localStorage.removeItem(EMAIL_KEY);
    }
    const cooldownUntil = Date.now() + EVENT_COOLDOWN_MS;
    window.localStorage.setItem(
      `${COOLDOWN_PREFIX}:${tableId}:${sessionId}:${action}`,
      String(cooldownUntil)
    );
    setCooldowns((current) => ({ ...current, [action]: cooldownUntil }));
    if (!options?.silent) {
      setFeedback({
        kind: "success",
        message:
          options?.successMessage ??
          payload?.message ??
          `${ACTION_LABELS[action]} enviado. El equipo ya recibió el aviso.`
      });
      setLoadingAction(null);
    }

    return true;
  }

  function handleExternalExperience(url: string | null, sourceLabel: "Pedí directo" | "Ver menú") {
    if (!url) {
      setFeedback({
        kind: "error",
        message:
          sourceLabel === "Pedí directo"
            ? "Esta mesa todavía no tiene link de pedido configurado."
            : "Falta configurar el link del menú para esta marca."
      });
      return;
    }

    const normalizedEmail = validateSessionForAction();
    if (normalizedEmail === null) {
      return;
    }

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = url;
    }

    const shouldNotifyArrival = cooldowns.VIEW_MENU <= Date.now();
    if (!shouldNotifyArrival) {
      return;
    }

    void submitAction("VIEW_MENU", {
      silent: true,
      successMessage: `${sourceLabel} abierto y mesa avisada al salón.`
    }).then((sent) => {
      if (!sent) {
        return;
      }

      setFeedback({
        kind: "success",
        message: `${sourceLabel} abierto y mesa avisada al salón.`
      });
    });
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
            className="px-5 pb-6 pt-5 sm:px-8"
            style={{
              background: `linear-gradient(140deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              color: heroTextColor
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em]" style={{ color: heroMutedTextColor }}>
                  {restaurantName}
                </div>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">{tableName}</h1>
              </div>
              {logoUrl ? (
                <div
                  className="h-14 w-14 overflow-hidden rounded-[20px] border"
                  style={{
                    borderColor: toRgba(heroTextColor, 0.22),
                    backgroundColor: heroCardBackground
                  }}
                >
                  <img alt={`${restaurantName} logo`} className="h-full w-full object-cover" src={logoUrl} />
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-6" style={{ color: heroMutedTextColor }}>
              Interfaz pensada para celular. Abrí el menú, pedí directo o avisale al salón
              sin esperar.
            </p>

            {bannerUrl ? (
              <div
                className="mt-5 overflow-hidden rounded-[24px] border"
                style={{
                  borderColor: toRgba(heroTextColor, 0.16),
                  backgroundColor: heroCardBackground
                }}
              >
                <img alt="Banner del restaurante" className="h-40 w-full object-cover" src={bannerUrl} />
                {bannerText ? (
                  <div className="px-4 py-3 text-sm font-medium" style={{ color: heroTextColor }}>
                    {bannerText}
                  </div>
                ) : null}
              </div>
            ) : bannerText ? (
              <div
                className="mt-5 rounded-[24px] border px-4 py-4 text-sm font-medium"
                style={{
                  borderColor: toRgba(heroTextColor, 0.16),
                  backgroundColor: heroCardBackground,
                  color: heroTextColor
                }}
              >
                {bannerText}
              </div>
            ) : null}
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-8">
            {customMessage ? (
              <div
                className="rounded-[24px] border px-4 py-4 text-sm leading-6"
                style={{
                  backgroundColor: customMessageBackground,
                  borderColor: toRgba(secondaryColor, 0.2),
                  color: customMessageTextColor
                }}
              >
                {customMessage}
              </div>
            ) : null}

            <div className="grid gap-3">
              <a
                className={`button-primary h-14 gap-2 rounded-[20px] text-base ${!primaryUrl ? "pointer-events-none opacity-60" : ""}`}
                href={primaryUrl ?? undefined}
                aria-disabled={!primaryUrl}
                onClick={(event) => {
                  event.preventDefault();
                  handleExternalExperience(primaryUrl, "Pedí directo");
                }}
                style={{
                  backgroundColor: directButtonBackground,
                  color: primaryButtonTextColor
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
                aria-disabled={!menuUrl}
                onClick={(event) => {
                  event.preventDefault();
                  handleExternalExperience(menuUrl, "Ver menú");
                }}
                style={{
                  backgroundColor: menuButtonBackground,
                  borderColor: toRgba(primaryColor, 0.15),
                  color: menuButtonTextColor
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

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="button-secondary h-14 gap-2 rounded-[20px] text-base"
                  disabled={loadingAction !== null || cooldowns.CALL_WAITER > Date.now()}
                  onClick={() => submitAction("CALL_WAITER")}
                  style={{
                    backgroundColor: menuButtonBackground,
                    borderColor: toRgba(primaryColor, 0.15),
                    color: menuButtonTextColor
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
                    backgroundColor: billButtonBackground,
                    borderColor: toRgba(secondaryColor, 0.2),
                    color: billButtonTextColor
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

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Email opcional</span>
                <input
                  className="input rounded-[20px]"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@email.com"
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
                  Quiero recibir novedades, promociones y beneficios del restaurante si dejé mi email.
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
          </div>
        </section>
      </div>
    </main>
  );
}
