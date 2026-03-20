import { notFound } from "next/navigation";

import { CustomerActions } from "@/components/customer-actions";
import { getDemoStore } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/runtime";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { RestaurantTable, Settings } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

interface TablePageProps {
  params: Promise<{ tableId: string }>;
}

export const dynamic = "force-dynamic";

export default async function TablePage({ params }: TablePageProps) {
  const { tableId } = await params;

  if (isDemoMode()) {
    const demo = getDemoStore();
    const table = demo.tables.find((item) => item.id === tableId);

    if (!table) {
      notFound();
    }

    return (
      <CustomerActions
        tableId={table.id}
        tableName={table.table_name}
        restaurantName={`${demo.settings.restaurant_name} - Demo`}
        primaryUrl={safeUrl(table.ordering_url) ?? safeUrl(demo.settings.direct_order_url)}
        menuUrl={safeUrl(table.menu_url_override) ?? safeUrl(demo.settings.global_menu_url)}
        logoUrl={safeUrl(demo.settings.logo_url)}
        bannerUrl={safeUrl(demo.settings.mobile_banner_url)}
        bannerText={demo.settings.mobile_banner_text}
        customMessage={demo.settings.custom_message}
        primaryColor={demo.settings.brand_primary_color}
        secondaryColor={demo.settings.brand_secondary_color}
        tertiaryColor={demo.settings.brand_tertiary_color}
      />
    );
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: table }, { data: settings }] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("*")
      .eq("id", tableId)
      .eq("active", true)
      .maybeSingle(),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle()
  ]);

  const typedTable = (table as RestaurantTable | null) ?? null;
  const typedSettings = (settings as Settings | null) ?? null;

  if (!typedTable || !typedSettings) {
    notFound();
  }

  const primaryUrl =
    safeUrl(typedTable.ordering_url) ??
    safeUrl(typedTable.menu_url_override) ??
    safeUrl(typedSettings.global_menu_url);

  return (
    <CustomerActions
      tableId={typedTable.id}
      tableName={typedTable.table_name}
      restaurantName={typedSettings.restaurant_name}
      primaryUrl={safeUrl(typedTable.ordering_url) ?? safeUrl(typedSettings.direct_order_url)}
      menuUrl={safeUrl(typedTable.menu_url_override) ?? safeUrl(typedSettings.global_menu_url)}
      logoUrl={safeUrl(typedSettings.logo_url)}
      bannerUrl={safeUrl(typedSettings.mobile_banner_url)}
      bannerText={typedSettings.mobile_banner_text}
      customMessage={typedSettings.custom_message}
      primaryColor={typedSettings.brand_primary_color}
      secondaryColor={typedSettings.brand_secondary_color}
      tertiaryColor={typedSettings.brand_tertiary_color}
    />
  );
}
