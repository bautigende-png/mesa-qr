import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { isDemoMode } from "@/lib/runtime";

const tableSchema = z.object({
  table_name: z.string().min(1),
  active: z.boolean(),
  sector: z.string().nullable().optional().transform((value) => value || null),
  ordering_url: z.string().url(),
  menu_url_override: z.string().nullable().optional().transform((value) => value || null)
});

interface RouteProps {
  params: Promise<{ tableId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const parsed = tableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { tableId } = await params;

  if (isDemoMode()) {
    const table = getDemoStore().tables.find((item) => item.id === tableId);
    if (!table) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    Object.assign(table, parsed.data, { updated_at: new Date().toISOString() });
    return NextResponse.json({ success: true, table });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("restaurant_tables")
    .update(parsed.data)
    .eq("id", tableId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, table: data });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { tableId } = await params;

  if (isDemoMode()) {
    const store = getDemoStore();
    store.tables = store.tables.filter((item) => item.id !== tableId);
    return NextResponse.json({ success: true });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { error } = await auth.supabase.from("restaurant_tables").delete().eq("id", tableId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
