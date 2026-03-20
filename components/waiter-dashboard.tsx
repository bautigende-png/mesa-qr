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

type AudioContextLike = AudioContext & {
  webkitClose?: () => Promise<void>;
};

const SOUND_KEY = "mesa-lista.waiter-sound-enabled";
const ALERT_VIBRATION_PATTERN = [250, 100, 250, 100, 350];

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
  const previousIds = useRef(new Set(initialEvents.map((event) => event.id)));
  const audioContextRef = useRef<AudioContextLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSoundEnabled(window.localStorage.getItem(SOUND_KEY) === "true");
  }, []);

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
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
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
    const newIds = nextEvents
      .filter((event) => !previousIds.current.has(event.id) && event.status === "PENDING")
      .map((event) => event.id);

    setEvents(nextEvents);

    if (newIds.length > 0) {
      if (soundEnabled) {
        void playBeep();
      } else {
        setSoundStatus("Llegó un evento nuevo. Activá sonido para escuchar el beep en este dispositivo.");
      }

      triggerHaptics();

      setHighlightedIds((current) => Array.from(new Set([...newIds, ...current])));
      window.setTimeout(() => {
        setHighlightedIds((current) => current.filter((id) => !newIds.includes(id)));
      }, 7000);
    }

    previousIds.current = new Set(nextEvents.map((event) => event.id));
  }

  async function ensureAudioContext() {
    const webkitWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass = window.AudioContext ?? webkitWindow.webkitAudioContext ?? null;

    if (!AudioContextClass) {
      setSoundStatus("Este navegador no permite generar sonido desde el panel.");
      return null;
    }

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextClass() as AudioContextLike;
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  async function playBeep() {
    const context = await ensureAudioContext();
    if (!context) {
      return;
    }

    const bursts = [
      { startOffset: 0, duration: 0.16, frequency: 880 },
      { startOffset: 0.26, duration: 0.16, frequency: 880 },
      { startOffset: 0.52, duration: 0.2, frequency: 960 }
    ];

    bursts.forEach((burst) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = burst.frequency;

      gain.gain.setValueAtTime(0.0001, context.currentTime + burst.startOffset);
      gain.gain.exponentialRampToValueAtTime(
        0.11,
        context.currentTime + burst.startOffset + 0.02
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + burst.startOffset + burst.duration
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + burst.startOffset);
      oscillator.stop(context.currentTime + burst.startOffset + burst.duration);
    });

    setSoundStatus("Sonido activo. Las alertas ahora usan 3 beeps más notorios.");
  }

  function triggerHaptics() {
    if ("vibrate" in navigator) {
      navigator.vibrate?.(ALERT_VIBRATION_PATTERN);
    }
  }

  async function enableSound() {
    triggerHaptics();
    await playBeep();
    window.localStorage.setItem(SOUND_KEY, "true");
    setSoundEnabled(true);
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

  const pendingCount = events.filter((event) => event.status === "PENDING").length;

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
              onClick={() => {
                triggerHaptics();
                void playBeep();
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
                    <p className="mt-2 text-sm text-slate-600">Cliente: {event.customer_email}</p>
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
                      disabled={event.status !== "PENDING" || busyAck || busyResolve}
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
                      RESOLVED
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
