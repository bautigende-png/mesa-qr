import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { isDemoMode } from "@/lib/runtime";
import type { RestaurantTable } from "@/lib/types";

const tableSchema = z.object({
  table_name: z.string().min(1),
  active: z.boolean(),
  sector: z.string().nullable().optional().transform((value) => value || null),
  ordering_url: z.string().url(),
  menu_url_override: z.string().nullable().optional().transform((value) => value || null)
});

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ tables: getDemoStore().tables });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .select("*")
    .order("table_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tables: ((data as RestaurantTable[] | null) ?? []) });
}

export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    const parsed = tableSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const table = {
      id: crypto.randomUUID(),
      ...parsed.data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    getDemoStore().tables.unshift(table);
    return NextResponse.json({ success: true, table });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = tableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, table: data as RestaurantTable });
}
