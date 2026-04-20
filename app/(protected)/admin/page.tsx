import { AdminDashboard } from "@/components/admin-dashboard";
import { LoginForm } from "@/components/login-form";
import { getDemoStore } from "@/lib/demo-store";
import { getSessionProfile } from "@/lib/auth";
import { computeAdminMetrics } from "@/lib/metrics";
import { isDemoMode } from "@/lib/runtime";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { EventRecord, Profile, RestaurantTable, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (isDemoMode()) {
    const demo = getDemoStore();
    return (
      <AdminDashboard
        profile={{
          id: "11111111-1111-1111-1111-111111111114",
          email: "admin@demo.local",
          full_name: "Admin Demo",
          role: "ADMIN",
          can_manage_direct_order: true,
          created_at: new Date().toISOString()
        }}
        initialTables={demo.tables}
        initialWaiters={demo.waiters}
        initialSettings={demo.settings}
        initialHistory={demo.events}
        initialMetrics={computeAdminMetrics(demo.events)}
      />
    );
  }

  const { session, profile } = await getSessionProfile();

  if (!session || !profile) {
    return (
      <main className="shell py-10">
        <LoginForm
          title="Panel administrador"
          subtitle="Ingresá con tu cuenta de administración para gestionar mesas, QR y usuarios."
          redirectTo="/admin"
        />
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [tablesRes, settingsRes, waitersRes, historyRes, metricsRes] = await Promise.all([
    supabase.from("restaurant_tables").select("*").order("table_name"),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "WAITER")
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*, restaurant_tables(id, table_name, sector)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("events")
      .select("*, restaurant_tables(id, table_name, sector)")
      .order("created_at", { ascending: false })
      .limit(5000)
  ]);

  const initialSettings =
    ({
      id: 1,
      restaurant_name: settingsRes.data?.restaurant_name ?? "Mi Restaurante",
      global_menu_url: settingsRes.data?.global_menu_url ?? null,
      direct_order_url: settingsRes.data?.direct_order_url ?? null,
      direct_order_enabled: settingsRes.data?.direct_order_enabled ?? false,
      logo_url: settingsRes.data?.logo_url ?? null,
      mobile_banner_url: settingsRes.data?.mobile_banner_url ?? null,
      mobile_banner_text: settingsRes.data?.mobile_banner_text ?? null,
      custom_message: settingsRes.data?.custom_message ?? null,
      brand_primary_color: settingsRes.data?.brand_primary_color ?? "#0f172a",
      brand_secondary_color: settingsRes.data?.brand_secondary_color ?? "#b45309",
      brand_tertiary_color: settingsRes.data?.brand_tertiary_color ?? "#f8f5ef",
      created_at: settingsRes.data?.created_at ?? new Date().toISOString(),
      updated_at: settingsRes.data?.updated_at ?? new Date().toISOString()
    } satisfies Settings);

  const initialMetrics = computeAdminMetrics(((metricsRes.data as EventRecord[] | null) ?? []));

  return (
    <AdminDashboard
      profile={profile}
      initialTables={((tablesRes.data as RestaurantTable[] | null) ?? [])}
      initialWaiters={((waitersRes.data as Profile[] | null) ?? [])}
      initialSettings={initialSettings}
      initialHistory={((historyRes.data as EventRecord[] | null) ?? [])}
      initialMetrics={initialMetrics}
    />
  );
}
