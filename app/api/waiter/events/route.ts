import { NextResponse } from "next/server";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasServiceRoleEnv, isDemoMode } from "@/lib/runtime";
import type { EventRecord } from "@/lib/types";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({
      events: getDemoStore().events.filter((event) => event.status !== "RESOLVED")
    });
  }

  const auth = await requireApiRole(["WAITER", "ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const supabase = hasServiceRoleEnv() ? createSupabaseAdminClient() : auth.supabase;
  const { data, error } = await supabase
    .from("events")
    .select("*, restaurant_tables(id, table_name, sector)")
    .neq("status", "RESOLVED")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: ((data as EventRecord[] | null) ?? []) });
}
