"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Clock3,
  Loader2,
  LogOut,
  Sparkles,
  TimerReset,
  Volume2,
  VolumeX
} from "lucide-react";
import { useRouter } from "next/navigation";

import { ACTION_LABELS, STATUS_LABELS } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { EventRecord, Profile } from "@/lib/types";
import { formatElapsed } from "@/lib/utils";

interface WaiterDashboardProps {
  profile: Profile;
  initialEvents: EventRecord[];
}

const SOUND_KEY = "mesa-lista.waiter-sound-enabled";
const ALERT_VIBRATION_PATTERN = [250, 100, 250, 100, 350];
const TITLE_FLASH_MS = 1200;
const PENDING_REMINDER_MS = 30_000;
const ACKNOWLEDGED_REMINDER_MS = 60_000;

function supportsRepeatingAlert(action: EventRecord["action"]) {
  return action === "CALL_WAITER" || action === "REQUEST_BILL";
}

function createAlertSoundDataUri(variant: "full" | "soft" = "full") {
  const sampleRate = 22_050;
  const durationSeconds = variant === "soft" ? 0.38 : 1.1;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const samples = new Int16Array(totalSamples);

  const beeps =
    variant === "soft"
      ? [{ start: 0.0, duration: 0.2, frequency: 920, volume: 0.78 }]
      : [
          { start: 0.0, duration: 0.18, frequency: 880, volume: 0.88 },
          { start: 0.28, duration: 0.18, frequency: 880, volume: 0.88 },
          { start: 0.56, duration: 0.24, frequency: 960, volume: 0.98 }
        ];

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    let value = 0;

    for (const beep of beeps) {
      if (t >= beep.start && t <= beep.start + beep.duration) {
        const elapsed = t - beep.start;
        const fadeIn = Math.min(1, elapsed / 0.02);
        const fadeOut = Math.min(1, (beep.start + beep.duration - t) / 0.04);
        const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
        value += Math.sin(2 * Math.PI * beep.frequency * elapsed) * beep.volume * envelope;
      }
    }

    samples[i] = Math.max(-1, Math.min(1, value)) * 32767;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  samples.forEach((sample, index) => {
    view.setInt16(44 + index * 2, sample, true);
  });

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function WaiterDashboard({ profile, initialEvents }: WaiterDashboardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [events, setEvents] = useState<EventRecord[]>(initialEvents);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundStatus, setSoundStatus] = useState(
    "Activá el sonido con un toque para asegurar alertas en iPhone y Safari."
  );
  const [lastAlertDebug, setLastAlertDebug] = useState("Sin alertas nuevas todavía.");
  const previousPendingIds = useRef(
    new Set(initialEvents.filter((event) => event.status === "PENDING").map((event) => event.id))
  );
  const latestSeenPendingCreatedAt = useRef(
    initialEvents
      .filter((event) => event.status === "PENDING")
      .reduce((latest, event) => (event.created_at > latest ? event.created_at : latest), "")
  );
  const titleFlashRef = useRef<number | null>(null);
  const alertAudioRef = useRef<Record<"full" | "soft", HTMLAudioElement | null>>({
    full: null,
    soft: null
  });
  const soundEnabledRef = useRef(false);
  const reminderSlotsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const enabled = window.localStorage.getItem(SOUND_KEY) === "true";
    setSoundEnabled(enabled);
    soundEnabledRef.current = enabled;

    const fullAudio = new Audio(createAlertSoundDataUri("full"));
    fullAudio.preload = "auto";
    fullAudio.setAttribute("playsinline", "true");

    const softAudio = new Audio(createAlertSoundDataUri("soft"));
    softAudio.preload = "auto";
    softAudio.setAttribute("playsinline", "true");

    alertAudioRef.current = {
      full: fullAudio,
      soft: softAudio
    };

    return () => {
      if (titleFlashRef.current) {
        window.clearTimeout(titleFlashRef.current);
      }
      document.title = "Mesa Lista";
      alertAudioRef.current.full?.pause();
      alertAudioRef.current.soft?.pause();
      alertAudioRef.current = { full: null, soft: null };
    };
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();

      for (const event of events) {
        if (!supportsRepeatingAlert(event.action)) {
          continue;
        }

        if (event.status === "PENDING") {
          const elapsed = now - new Date(event.created_at).getTime();
          const slot = Math.floor(elapsed / PENDING_REMINDER_MS);
          const key = `${event.id}:PENDING`;

          if (slot >= 1 && slot > (reminderSlotsRef.current[key] ?? 0)) {
            reminderSlotsRef.current[key] = slot;
            void triggerAlertFeedback(soundEnabledRef.current);
            setLastAlertDebug(
              `Recordatorio: ${ACTION_LABELS[event.action]} en ${event.restaurant_tables?.table_name ?? "Mesa"} sigue pendiente.`
            );
            setHighlightedIds((current) => Array.from(new Set([event.id, ...current])));
            window.setTimeout(() => {
              setHighlightedIds((current) => current.filter((id) => id !== event.id));
            }, 7000);
            break;
          }
        }

        if (event.status === "ACKNOWLEDGED" && event.acknowledged_at) {
          const elapsed = now - new Date(event.acknowledged_at).getTime();
          const slot = Math.floor(elapsed / ACKNOWLEDGED_REMINDER_MS);
          const key = `${event.id}:ACKNOWLEDGED`;

          if (slot >= 1 && slot > (reminderSlotsRef.current[key] ?? 0)) {
            reminderSlotsRef.current[key] = slot;
            void triggerAlertFeedback(soundEnabledRef.current);
            setLastAlertDebug(
              `Recordatorio: ${ACTION_LABELS[event.action]} en ${event.restaurant_tables?.table_name ?? "Mesa"} fue leído pero sigue sin resolver.`
            );
            setHighlightedIds((current) => Array.from(new Set([event.id, ...current])));
            window.setTimeout(() => {
              setHighlightedIds((current) => current.filter((id) => id !== event.id));
            }, 7000);
            break;
          }
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [events]);

  useEffect(() => {
    const fetchLatest = async () => {
      const response = await fetch("/api/waiter/events", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { events: EventRecord[] };
      mergeIncoming(payload.events);
    };

    const interval = window.setInterval(fetchLatest, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("waiter-events")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events"
        },
        () => {
          void refreshEvents();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  async function refreshEvents() {
    const response = await fetch("/api/waiter/events", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { events: EventRecord[] };
    mergeIncoming(payload.events);
  }

  function mergeIncoming(nextEvents: EventRecord[]) {
    reminderSlotsRef.current = Object.fromEntries(
      Object.entries(reminderSlotsRef.current).filter(([key]) =>
        nextEvents.some((event) => key.startsWith(`${event.id}:`) && event.status !== "RESOLVED")
      )
    );

    const pendingEvents = nextEvents.filter((event) => event.status === "PENDING");
    const nextPendingIds = new Set(pendingEvents.map((event) => event.id));
    const newestPendingCreatedAt = pendingEvents.reduce(
      (latest, event) => (event.created_at > latest ? event.created_at : latest),
      ""
    );

    const newIds = pendingEvents
      .filter(
        (event) =>
          !previousPendingIds.current.has(event.id) ||
          event.created_at > latestSeenPendingCreatedAt.current
      )
      .map((event) => event.id);

    const pendingCountIncreased = nextPendingIds.size > previousPendingIds.current.size;

    setEvents(nextEvents);

    if (newIds.length > 0 || pendingCountIncreased) {
      const nextNewEvents = nextEvents.filter((event) => newIds.includes(event.id));
      const variant =
        nextNewEvents.length > 0 && nextNewEvents.every((event) => event.action === "VIEW_MENU")
          ? "soft"
          : "full";
      void triggerAlertFeedback(soundEnabledRef.current, variant);
      setLastAlertDebug(
        `Ultima alerta: ${new Date().toLocaleTimeString("es-AR")} · nuevos pendientes ${Math.max(newIds.length, nextPendingIds.size - previousPendingIds.current.size)}`
      );

      const idsToHighlight = newIds.length > 0 ? newIds : pendingEvents.map((event) => event.id);
      setHighlightedIds((current) => Array.from(new Set([...idsToHighlight, ...current])));
      window.setTimeout(() => {
        setHighlightedIds((current) => current.filter((id) => !idsToHighlight.includes(id)));
      }, 7000);
    }

    previousPendingIds.current = nextPendingIds;
    latestSeenPendingCreatedAt.current = newestPendingCreatedAt;
  }

  async function playAlertSound(variant: "full" | "soft" = "full") {
    const audio = alertAudioRef.current[variant];

    if (!audio) {
      setSoundStatus("No pudimos preparar el audio de alertas en este dispositivo.");
      return false;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      await audio.play();
      setSoundStatus(
        variant === "soft"
          ? "Sonido activo. Las alertas de llegada usan un solo pip."
          : "Sonido activo. Las alertas usan 3 beeps fuertes."
      );
      return true;
    } catch {
      setSoundStatus(
        "El navegador bloqueó el audio. Tocá Activar sonido o Probar sonido otra vez."
      );
      return false;
    }
  }

  function triggerHaptics() {
    if ("vibrate" in navigator) {
      navigator.vibrate?.(ALERT_VIBRATION_PATTERN);
    }
  }

  function flashTitle() {
    document.title = "Nuevo llamado - Mesa Lista";
    if (titleFlashRef.current) {
      window.clearTimeout(titleFlashRef.current);
    }
    titleFlashRef.current = window.setTimeout(() => {
      document.title = "Mesa Lista";
      titleFlashRef.current = null;
    }, TITLE_FLASH_MS);
  }

  async function triggerAlertFeedback(
    isSoundEnabled: boolean,
    variant: "full" | "soft" = "full"
  ) {
    flashTitle();
    triggerHaptics();

    if (isSoundEnabled) {
      await playAlertSound(variant);
    } else {
      setSoundStatus(
        "Llegó un evento nuevo. Activá sonido para escuchar la alerta en este dispositivo."
      );
    }
  }

  async function enableSound() {
    triggerHaptics();
    const unlocked = await playAlertSound();
    if (unlocked) {
      window.localStorage.setItem(SOUND_KEY, "true");
      setSoundEnabled(true);
    }
  }

  function disableSound() {
    window.localStorage.removeItem(SOUND_KEY);
    setSoundEnabled(false);
    setSoundStatus("Sonido desactivado para este dispositivo.");
  }

  async function updateStatus(eventId: string, status: "ACKNOWLEDGED" | "RESOLVED") {
    setPendingActionId(eventId + status);

    const response = await fetch(`/api/waiter/events/${eventId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    setPendingActionId(null);

    if (!response.ok) {
      return;
    }

    await refreshEvents();
  }

  async function handleLogout() {
    if (!supabase) {
      router.push("/");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    router.push("/waiter");
    router.refresh();
  }

  const pendingCount = events.filter(
    (event) => event.status === "PENDING" && event.action !== "VIEW_MENU"
  ).length;

  return (
    <main className="shell space-y-5">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-6 bg-slate-950 px-6 py-7 text-white sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-amber-300">Panel mozo</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sala en tiempo real</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Sesión iniciada como {profile.email}. En iPhone conviene activar sonido
              manualmente una vez por dispositivo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Pendientes</div>
              <div className="mt-1 text-2xl font-semibold">{pendingCount}</div>
            </div>
            <button className="button-secondary gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sonido de alertas</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{soundStatus}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
              {lastAlertDebug}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Re-alerta cada 30s si sigue pendiente y cada 60s si fue leído pero no resuelto.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!soundEnabled ? (
              <button className="button-primary gap-2" onClick={enableSound}>
                <Volume2 className="h-4 w-4" />
                Activar sonido
              </button>
            ) : (
              <button className="button-secondary gap-2" onClick={disableSound}>
                <VolumeX className="h-4 w-4" />
                Desactivar
              </button>
            )}
            <button
              className="button-secondary gap-2"
              onClick={async () => {
                triggerHaptics();
                const unlocked = await playAlertSound();
                if (unlocked) {
                  window.localStorage.setItem(SOUND_KEY, "true");
                  setSoundEnabled(true);
                }
              }}
            >
              <Bell className="h-4 w-4" />
              Probar sonido
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {events.length === 0 ? (
          <div className="panel px-6 py-12 text-center sm:px-8">
            <Sparkles className="mx-auto h-10 w-10 text-amber-600" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Todo al día</h2>
            <p className="mt-2 text-sm text-slate-600">
              No hay eventos pendientes o recientes para mostrar.
            </p>
          </div>
        ) : null}

        {events.map((event) => {
          const highlighted = highlightedIds.includes(event.id);
          const busyAck = pendingActionId === `${event.id}ACKNOWLEDGED`;
          const busyResolve = pendingActionId === `${event.id}RESOLVED`;
          const isArrivalEvent = event.action === "VIEW_MENU";

          return (
            <article
              key={event.id}
              className={`panel px-5 py-5 transition sm:px-6 ${
                highlighted ? "ring-2 ring-amber-300" : ""
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                      {event.restaurant_tables?.table_name ?? "Mesa"}
                    </span>
                    {event.restaurant_tables?.sector ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {event.restaurant_tables.sector}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {STATUS_LABELS[event.status]}
                    </span>
                    {highlighted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        <BellRing className="h-3.5 w-3.5" />
                        Nuevo
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {ACTION_LABELS[event.action]}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Cliente: {event.customer_email ?? "Sin email"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-amber-700" />
                    Esperando hace {formatElapsed(event.created_at)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="button-secondary gap-2"
                      disabled={
                        isArrivalEvent || event.status !== "PENDING" || busyAck || busyResolve
                      }
                      onClick={() => updateStatus(event.id, "ACKNOWLEDGED")}
                    >
                      {busyAck ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TimerReset className="h-4 w-4" />
                      )}
                      ACKNOWLEDGED
                    </button>
                    <button
                      className="button-primary gap-2"
                      disabled={event.status === "RESOLVED" || busyAck || busyResolve}
                      onClick={() => updateStatus(event.id, "RESOLVED")}
                    >
                      {busyResolve ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCheck className="h-4 w-4" />
                      )}
                      {isArrivalEvent ? "VISTO" : "RESOLVED"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
