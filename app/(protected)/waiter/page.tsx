import { LoginForm } from "@/components/login-form";
import { WaiterDashboard } from "@/components/waiter-dashboard";
import { getDemoStore } from "@/lib/demo-store";
import { getSessionProfile } from "@/lib/auth";
import { hasServiceRoleEnv, isDemoMode } from "@/lib/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { EventRecord, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  if (isDemoMode()) {
    const demo = getDemoStore();
    return (
      <WaiterDashboard
        profile={demo.waiters[0]}
        initialEvents={demo.events.filter((event) => event.status !== "RESOLVED")}
        initialDirectOrderEnabled={demo.settings.direct_order_enabled}
      />
    );
  }

  const { session, profile } = await getSessionProfile();

  if (!session || !profile) {
    return (
      <main className="shell py-10">
        <LoginForm
          title="Panel del mozo"
          subtitle="Ingresá con tu cuenta del restaurante para ver llamados y pedidos de cuenta."
          redirectTo="/waiter"
        />
      </main>
    );
  }

  const supabase = hasServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  const [{ data: events }, { data: settings }] = await Promise.all([
    supabase
      .from("events")
      .select("*, restaurant_tables(id, table_name, sector)")
      .neq("status", "RESOLVED")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase.from("settings").select("direct_order_enabled").eq("id", 1).maybeSingle()
  ]);

  return (
    <WaiterDashboard
      profile={profile}
      initialEvents={((events as EventRecord[] | null) ?? [])}
      initialDirectOrderEnabled={Boolean((settings as Pick<Settings, "direct_order_enabled"> | null)?.direct_order_enabled)}
    />
  );
}
