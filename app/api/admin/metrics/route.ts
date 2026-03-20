import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/api";
import { getDemoStore } from "@/lib/demo-store";
import { computeAdminMetrics } from "@/lib/metrics";
import { isDemoMode } from "@/lib/runtime";
import type { EventRecord } from "@/lib/types";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ metrics: computeAdminMetrics(getDemoStore().events) });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("events")
    .select("*, restaurant_tables(id, table_name, sector)")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    metrics: computeAdminMetrics(((data as EventRecord[] | null) ?? []))
  });
}
