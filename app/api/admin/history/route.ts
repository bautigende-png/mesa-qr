import { NextRequest, NextResponse } from "next/server";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { isDemoMode } from "@/lib/runtime";
import type { EventRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const tableId = searchParams.get("tableId");
  const action = searchParams.get("action");
  const status = searchParams.get("status");

  if (isDemoMode()) {
    let history = [...getDemoStore().events];
    if (from) history = history.filter((item) => item.created_at >= `${from}T00:00:00.000Z`);
    if (to) history = history.filter((item) => item.created_at <= `${to}T23:59:59.999Z`);
    if (tableId) history = history.filter((item) => item.table_id === tableId);
    if (action) history = history.filter((item) => item.action === action);
    if (status) history = history.filter((item) => item.status === status);
    return NextResponse.json({ history });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  let query = auth.supabase
    .from("events")
    .select("*, restaurant_tables(id, table_name, sector)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }

  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }

  if (tableId) {
    query = query.eq("table_id", tableId);
  }

  if (action) {
    query = query.eq("action", action);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: ((data as EventRecord[] | null) ?? []) });
}
