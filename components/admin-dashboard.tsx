"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Bell, ChartColumnIncreasing, Clock3, Download, Loader2, LogOut, Plus, Printer, QrCode, ReceiptText, Save, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { ACTION_LABELS, EVENT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AdminMetrics, EventRecord, Profile, RestaurantTable, Settings } from "@/lib/types";
import { formatElapsed, getBaseUrl } from "@/lib/utils";

interface AdminDashboardProps {
  profile: Profile;
  initialTables: RestaurantTable[];
  initialWaiters: Profile[];
  initialSettings: Settings;
  initialHistory: EventRecord[];
  initialMetrics: AdminMetrics;
}

interface TableFormState {
  table_name: string;
  sector: string;
  ordering_url: string;
  menu_url_override: string;
  active: boolean;
}

const EMPTY_TABLE: TableFormState = {
  table_name: "",
  sector: "",
  ordering_url: "",
  menu_url_override: "",
  active: true
};

export function AdminDashboard({
  profile,
  initialTables,
  initialWaiters,
  initialSettings,
  initialHistory,
  initialMetrics
}: AdminDashboardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [tables, setTables] = useState(initialTables);
  const [waiters, setWaiters] = useState(initialWaiters);
  const [settings, setSettings] = useState(initialSettings);
  const [history, setHistory] = useState(initialHistory);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [tableForm, setTableForm] = useState<TableFormState>(EMPTY_TABLE);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [savingTable, setSavingTable] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingWaiter, setCreatingWaiter] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    tableId: "",
    action: "",
    status: ""
  });
  const [newWaiter, setNewWaiter] = useState({
    full_name: "",
    email: "",
    password: ""
  });

  async function handleLogout() {
    if (!supabase) {
      router.push("/");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    router.push("/admin");
    router.refresh();
  }

  async function refreshTables() {
    const response = await fetch("/api/admin/tables", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { tables: RestaurantTable[] };
    setTables(payload.tables);
  }

  async function refreshWaiters() {
    const response = await fetch("/api/admin/waiters", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { waiters: Profile[] };
    setWaiters(payload.waiters);
  }

  async function refreshMetrics() {
    const response = await fetch("/api/admin/metrics", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { metrics: AdminMetrics };
    setMetrics(payload.metrics);
  }

  async function handleTableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTable(true);

    const method = editingTableId ? "PATCH" : "POST";
    const url = editingTableId
      ? `/api/admin/tables/${editingTableId}`
      : "/api/admin/tables";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tableForm)
    });

    setSavingTable(false);

    if (!response.ok) {
      return;
    }

    setTableForm(EMPTY_TABLE);
    setEditingTableId(null);
    await refreshTables();
  }

  function startEdit(table: RestaurantTable) {
    setEditingTableId(table.id);
    setTableForm({
      table_name: table.table_name,
      sector: table.sector ?? "",
      ordering_url: table.ordering_url,
      menu_url_override: table.menu_url_override ?? "",
      active: table.active
    });
  }

  async function handleDeleteTable(tableId: string) {
    const response = await fetch(`/api/admin/tables/${tableId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      return;
    }

    await refreshTables();
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });

    setSavingSettings(false);

    if (!response.ok) {
      return;
    }
  }

  async function handleCreateWaiter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingWaiter(true);

    const response = await fetch("/api/admin/waiters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newWaiter)
    });

    setCreatingWaiter(false);

    if (!response.ok) {
      return;
    }

    setNewWaiter({ full_name: "", email: "", password: "" });
    await refreshWaiters();
  }

  async function handleDeleteWaiter(waiterId: string) {
    const response = await fetch(`/api/admin/waiters/${waiterId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      return;
    }

    await refreshWaiters();
  }

  async function fetchHistory() {
    const params = new URLSearchParams();
    if (historyFilters.from) params.set("from", historyFilters.from);
    if (historyFilters.to) params.set("to", historyFilters.to);
    if (historyFilters.tableId) params.set("tableId", historyFilters.tableId);
    if (historyFilters.action) params.set("action", historyFilters.action);
    if (historyFilters.status) params.set("status", historyFilters.status);

    const response = await fetch(`/api/admin/history?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { history: EventRecord[] };
    setHistory(payload.history);
  }

  useEffect(() => {
    void fetchHistory();
    void refreshMetrics();
  }, []);

  async function downloadQr(table: RestaurantTable) {
    const url = `${getBaseUrl()}/t/${table.id}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1200,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      }
    });

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${table.table_name.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    anchor.click();
  }

  async function printQr(table: RestaurantTable) {
    const url = `${getBaseUrl()}/t/${table.id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 900, margin: 2 });
    const printWindow = window.open("", "_blank", "width=900,height=1200");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${table.table_name}</title>
          <style>
            body { font-family: ui-sans-serif, system-ui; margin: 0; display: grid; place-items: center; min-height: 100vh; }
            .sheet { width: 100%; max-width: 800px; text-align: center; padding: 48px; }
            h1 { font-size: 64px; margin-bottom: 16px; }
            p { font-size: 24px; color: #475569; }
            img { width: 100%; max-width: 520px; margin-top: 32px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1>${table.table_name}</h1>
            <p>${settings.restaurant_name}</p>
            <img src="${dataUrl}" alt="QR" />
            <p>${url}</p>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <main className="shell space-y-5">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-6 bg-slate-950 px-6 py-7 text-white sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-amber-300">Admin</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Centro de control</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Sesión iniciada como {profile.email}. Desde acá administrás mesas, QR,
              settings globales y usuarios de piso.
            </p>
          </div>
          <button className="button-secondary gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <form className="panel p-6 sm:p-8" onSubmit={handleSaveSettings}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Marca y contenido mobile</h2>
              <p className="mt-2 text-sm text-slate-600">
                Logo, colores, banner, links y textos personalizables para cada restaurant.
              </p>
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Nombre del restaurant</span>
                  <input
                    className="input"
                    value={settings.restaurant_name}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        restaurant_name: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Logo URL</span>
                  <input
                    className="input"
                    type="url"
                    value={settings.logo_url ?? ""}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        logo_url: event.target.value
                      }))
                    }
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Banner mobile URL</span>
                  <input
                    className="input"
                    type="url"
                    value={settings.mobile_banner_url ?? ""}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        mobile_banner_url: event.target.value
                      }))
                    }
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Texto del banner</span>
                  <input
                    className="input"
                    value={settings.mobile_banner_text ?? ""}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        mobile_banner_text: event.target.value
                      }))
                    }
                    placeholder="2x1 en vermú hasta las 20 hs"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Link del menú</span>
                  <input
                    className="input"
                    type="url"
                    value={settings.global_menu_url ?? ""}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        global_menu_url: event.target.value
                      }))
                    }
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Link de "Pedí directo"</span>
                  <input
                    className="input"
                    type="url"
                    value={settings.direct_order_url ?? ""}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        direct_order_url: event.target.value
                      }))
                    }
                    placeholder="https://..."
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Texto informativo / promo</span>
                  <textarea
                    className="input min-h-28 resize-y"
                    value={settings.custom_message ?? ""}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        custom_message: event.target.value
                      }))
                    }
                    placeholder="Cargá promociones, mensajes o información especial del restaurant."
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Color principal</span>
                  <div className="flex gap-3">
                    <input
                      className="h-12 w-16 rounded-2xl border border-slate-200 bg-white p-1"
                      type="color"
                      value={settings.brand_primary_color}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          brand_primary_color: event.target.value
                        }))
                      }
                    />
                    <input
                      className="input"
                      value={settings.brand_primary_color}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          brand_primary_color: event.target.value
                        }))
                      }
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Color secundario</span>
                  <div className="flex gap-3">
                    <input
                      className="h-12 w-16 rounded-2xl border border-slate-200 bg-white p-1"
                      type="color"
                      value={settings.brand_secondary_color}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          brand_secondary_color: event.target.value
                        }))
                      }
                    />
                    <input
                      className="input"
                      value={settings.brand_secondary_color}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          brand_secondary_color: event.target.value
                        }))
                      }
                    />
                  </div>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Color terciario / fondo</span>
                  <div className="flex gap-3">
                    <input
                      className="h-12 w-16 rounded-2xl border border-slate-200 bg-white p-1"
                      type="color"
                      value={settings.brand_tertiary_color}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          brand_tertiary_color: event.target.value
                        }))
                      }
                    />
                    <input
                      className="input"
                      value={settings.brand_tertiary_color}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          brand_tertiary_color: event.target.value
                        }))
                      }
                    />
                  </div>
                </label>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-medium text-slate-700">Preview mobile</div>
                <div
                  className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-sm"
                  style={{
                    background: `linear-gradient(180deg, ${settings.brand_tertiary_color} 0%, #ffffff 100%)`
                  }}
                >
                  <div
                    className="px-4 pb-4 pt-4 text-white"
                    style={{
                      background: `linear-gradient(140deg, ${settings.brand_primary_color} 0%, ${settings.brand_secondary_color} 100%)`
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/70">
                          {settings.restaurant_name}
                        </div>
                        <div className="mt-2 text-2xl font-semibold">Mesa 12</div>
                      </div>
                      {settings.logo_url ? (
                        <img
                          alt="Logo preview"
                          className="h-12 w-12 rounded-2xl object-cover"
                          src={settings.logo_url}
                        />
                      ) : null}
                    </div>
                    {settings.mobile_banner_url ? (
                      <img
                        alt="Banner preview"
                        className="mt-4 h-28 w-full rounded-[20px] object-cover"
                        src={settings.mobile_banner_url}
                      />
                    ) : null}
                    {settings.mobile_banner_text ? (
                      <div className="mt-3 text-sm text-white/90">{settings.mobile_banner_text}</div>
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    {settings.custom_message ? (
                      <div
                        className="rounded-[18px] px-3 py-3 text-sm"
                        style={{
                          backgroundColor: settings.brand_tertiary_color,
                          color: settings.brand_primary_color
                        }}
                      >
                        {settings.custom_message}
                      </div>
                    ) : null}
                    <div
                      className="rounded-[18px] px-4 py-3 text-center text-sm font-semibold text-white"
                      style={{ backgroundColor: settings.brand_primary_color }}
                    >
                      Pedí directo
                    </div>
                    <div
                      className="rounded-[18px] border px-4 py-3 text-center text-sm font-semibold"
                      style={{
                        borderColor: `${settings.brand_primary_color}22`,
                        color: settings.brand_primary_color
                      }}
                    >
                      Ver menú
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button className="button-primary mt-5 gap-2" disabled={savingSettings} type="submit">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar diseño y contenido
            </button>
          </form>

          <form className="panel p-6 sm:p-8" onSubmit={handleTableSubmit}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Mesas</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Alta, edición y QR de acceso por mesa.
                </p>
              </div>
              {editingTableId ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setEditingTableId(null);
                    setTableForm(EMPTY_TABLE);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Table name</span>
                <input
                  className="input"
                  value={tableForm.table_name}
                  onChange={(event) =>
                    setTableForm((current) => ({ ...current, table_name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Sector</span>
                <input
                  className="input"
                  value={tableForm.sector}
                  onChange={(event) =>
                    setTableForm((current) => ({ ...current, sector: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Ordering URL</span>
                <input
                  className="input"
                  type="url"
                  value={tableForm.ordering_url}
                  onChange={(event) =>
                    setTableForm((current) => ({
                      ...current,
                      ordering_url: event.target.value
                    }))
                  }
                  required
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Menu URL override</span>
                <input
                  className="input"
                  type="url"
                  value={tableForm.menu_url_override}
                  onChange={(event) =>
                    setTableForm((current) => ({
                      ...current,
                      menu_url_override: event.target.value
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={tableForm.active}
                  onChange={(event) =>
                    setTableForm((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                <span className="text-sm text-slate-700">Mesa activa</span>
              </label>
            </div>

            <button className="button-primary mt-5 gap-2" disabled={savingTable} type="submit">
              {savingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTableId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingTableId ? "Actualizar mesa" : "Crear mesa"}
            </button>
          </form>
        </div>

        <div className="space-y-5">
          <section className="panel p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Mesas activas</h2>
              <p className="mt-2 text-sm text-slate-600">
                QR descargable y hoja de impresión por mesa.
              </p>
            </div>

            <div className="space-y-3">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{table.table_name}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {table.active ? "Activa" : "Inactiva"}
                        </span>
                        {table.sector ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            {table.sector}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{table.ordering_url}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="button-secondary gap-2" onClick={() => startEdit(table)}>
                        <Save className="h-4 w-4" />
                        Editar
                      </button>
                      <button className="button-secondary gap-2" onClick={() => downloadQr(table)}>
                        <Download className="h-4 w-4" />
                        PNG
                      </button>
                      <button className="button-secondary gap-2" onClick={() => printQr(table)}>
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                      <button className="button-secondary gap-2" onClick={() => handleDeleteTable(table.id)}>
                        <Trash2 className="h-4 w-4" />
                        Borrar
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                    <QrCode className="h-4 w-4" />
                    {getBaseUrl()}/t/{table.id}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                <Users className="h-5 w-5 text-amber-700" />
                Mozos
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Alta de usuarios con email y password.
              </p>
            </div>

            <form className="grid gap-4" onSubmit={handleCreateWaiter}>
              <input
                className="input"
                placeholder="Nombre completo"
                value={newWaiter.full_name}
                onChange={(event) =>
                  setNewWaiter((current) => ({ ...current, full_name: event.target.value }))
                }
                required
              />
              <input
                className="input"
                type="email"
                placeholder="mozo@restaurant.com"
                value={newWaiter.email}
                onChange={(event) =>
                  setNewWaiter((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Password temporal"
                value={newWaiter.password}
                onChange={(event) =>
                  setNewWaiter((current) => ({ ...current, password: event.target.value }))
                }
                required
                minLength={8}
              />
              <button className="button-primary gap-2" disabled={creatingWaiter} type="submit">
                {creatingWaiter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear mozo
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {waiters.map((waiter) => (
                <div
                  key={waiter.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{waiter.full_name ?? "Sin nombre"}</p>
                    <p className="text-sm text-slate-600">{waiter.email}</p>
                  </div>
                  <button
                    className="button-secondary gap-2"
                    onClick={() => handleDeleteWaiter(waiter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <ChartColumnIncreasing className="h-5 w-5 text-amber-700" />
              Métricas
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Resumen operativo para seguir demanda, tiempos y sectores calientes.
            </p>
          </div>
          <button className="button-secondary" onClick={refreshMetrics}>
            Actualizar métricas
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Eventos totales",
              value: metrics.summary.total_events,
              icon: ChartColumnIncreasing
            },
            {
              label: "Llamados al mozo",
              value: metrics.summary.waiter_calls,
              icon: Bell
            },
            {
              label: "Pedidos de cuenta",
              value: metrics.summary.bill_requests,
              icon: ReceiptText
            },
            {
              label: "Pendientes",
              value: metrics.summary.pending_events,
              icon: Clock3
            },
            {
              label: "Marketing opt-in",
              value: `${metrics.summary.marketing_opt_in_rate}%`,
              icon: Users
            }
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">{item.label}</span>
                <item.icon className="h-4 w-4 text-amber-700" />
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Últimos 7 días</h3>
              <p className="mt-1 text-sm text-slate-600">
                Evolución diaria de eventos del salón.
              </p>
            </div>
            <div className="space-y-3">
              {metrics.daily.map((point) => {
                const maxValue = Math.max(...metrics.daily.map((item) => item.total_events), 1);
                const width = `${(point.total_events / maxValue) * 100}%`;

                return (
                  <div key={point.date}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                      <span>{point.label}</span>
                      <span>{point.total_events} eventos</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-slate-900" style={{ width }} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {point.waiter_calls} mozo · {point.bill_requests} cuenta
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Tiempos promedio</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-4">
                  <div className="text-sm text-slate-600">Hasta acknowledged</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {metrics.summary.avg_minutes_to_acknowledge ?? "-"} min
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4">
                  <div className="text-sm text-slate-600">Hasta resolved</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {metrics.summary.avg_minutes_to_resolve ?? "-"} min
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Estado de eventos</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {metrics.statuses.map((status) => (
                  <div key={status.status} className="rounded-2xl bg-white px-4 py-4">
                    <div className="text-sm text-slate-600">{STATUS_LABELS[status.status]}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {status.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Mesas con más actividad</h3>
            <div className="mt-4 space-y-3">
              {metrics.top_tables.map((table) => (
                <div key={table.table_id} className="rounded-2xl bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{table.table_name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {table.waiter_calls} mozo · {table.bill_requests} cuenta
                      </div>
                    </div>
                    <div className="text-2xl font-semibold text-slate-900">
                      {table.total_events}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Eventos por sector</h3>
            <div className="mt-4 space-y-3">
              {metrics.sectors.map((sector) => {
                const maxValue = Math.max(...metrics.sectors.map((item) => item.total_events), 1);
                const width = `${(sector.total_events / maxValue) * 100}%`;

                return (
                  <div key={sector.sector}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                      <span>{sector.sector}</span>
                      <span>{sector.total_events}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-amber-600" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Historial de eventos</h2>
            <p className="mt-2 text-sm text-slate-600">
              Filtros por rango, mesa, acción y estado.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input
            className="input"
            type="date"
            value={historyFilters.from}
            onChange={(event) =>
              setHistoryFilters((current) => ({ ...current, from: event.target.value }))
            }
          />
          <input
            className="input"
            type="date"
            value={historyFilters.to}
            onChange={(event) =>
              setHistoryFilters((current) => ({ ...current, to: event.target.value }))
            }
          />
          <select
            className="input"
            value={historyFilters.tableId}
            onChange={(event) =>
              setHistoryFilters((current) => ({ ...current, tableId: event.target.value }))
            }
          >
            <option value="">Todas las mesas</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.table_name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={historyFilters.action}
            onChange={(event) =>
              setHistoryFilters((current) => ({ ...current, action: event.target.value }))
            }
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={historyFilters.status}
            onChange={(event) =>
              setHistoryFilters((current) => ({ ...current, status: event.target.value }))
            }
          >
            <option value="">Todos los estados</option>
            {EVENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <button className="button-primary mt-4 gap-2" onClick={fetchHistory}>
          <Search className="h-4 w-4" />
          Aplicar filtros
        </button>

        <div className="mt-6 space-y-3">
          {history.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {item.restaurant_tables?.table_name ?? "Mesa"}
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {ACTION_LABELS[item.action]}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.customer_email}</p>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>Creado hace {formatElapsed(item.created_at)}</p>
                  <p>{new Date(item.created_at).toLocaleString("es-AR")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
