import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ACTION_LABELS, EVENT_COOLDOWN_MS } from "@/lib/constants";
import { getDemoStore } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const createEventSchema = z.object({
  tableId: z.string().uuid(),
  sessionId: z.string().uuid(),
  action: z.enum(["CALL_WAITER", "REQUEST_BILL"]),
  customerEmail: z.string().email(),
  marketingOptIn: z.boolean().optional().default(false)
});

export async function POST(request: NextRequest) {
  const parsed = createEventSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (isDemoMode()) {
    const demo = getDemoStore();
    const table = demo.tables.find((item) => item.id === parsed.data.tableId && item.active);

    if (!table) {
      return NextResponse.json({ error: "Mesa no disponible" }, { status: 404 });
    }

    const recentEvent = demo.events.find(
      (event) =>
        event.table_id === parsed.data.tableId &&
        event.session_id === parsed.data.sessionId &&
        event.action === parsed.data.action &&
        Date.now() - new Date(event.created_at).getTime() < EVENT_COOLDOWN_MS
    );

    if (recentEvent) {
      return NextResponse.json(
        {
          error: `Ya recibimos tu pedido de ${ACTION_LABELS[parsed.data.action]}. Esperá un momento para volver a enviarlo.`,
          retryAfterSeconds: 60
        },
        { status: 429 }
      );
    }

    demo.events.unshift({
      id: crypto.randomUUID(),
      table_id: table.id,
      action: parsed.data.action,
      status: "PENDING",
      customer_email: parsed.data.customerEmail,
      marketing_opt_in: parsed.data.marketingOptIn,
      session_id: parsed.data.sessionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      acknowledged_at: null,
      resolved_at: null,
      restaurant_tables: {
        id: table.id,
        table_name: table.table_name,
        sector: table.sector
      }
    });

    return NextResponse.json({
      message: `${ACTION_LABELS[parsed.data.action]} enviado para ${table.table_name}.`
    });
  }

  const supabase = createSupabaseAdminClient();

  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("id, table_name, active")
    .eq("id", parsed.data.tableId)
    .eq("active", true)
    .maybeSingle();

  const cooldownThreshold = new Date(Date.now() - EVENT_COOLDOWN_MS).toISOString();
  const { data: recentEvent } = await supabase
    .from("events")
    .select("id, created_at")
    .eq("table_id", parsed.data.tableId)
    .eq("session_id", parsed.data.sessionId)
    .eq("action", parsed.data.action)
    .gte("created_at", cooldownThreshold)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const typedTable = (table as { id: string; table_name: string; active: boolean } | null) ?? null;
  const typedRecentEvent = (recentEvent as { id: string; created_at: string } | null) ?? null;

  if (!typedTable) {
    return NextResponse.json({ error: "Mesa no disponible" }, { status: 404 });
  }

  if (typedRecentEvent) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (new Date(typedRecentEvent.created_at).getTime() + EVENT_COOLDOWN_MS - Date.now()) / 1000
      )
    );

    return NextResponse.json(
      {
        error: `Ya recibimos tu pedido de ${ACTION_LABELS[parsed.data.action]}. Esperá un momento para volver a enviarlo.`,
        retryAfterSeconds
      },
      { status: 429 }
    );
  }

  const { error } = await supabase.from("events").insert({
    table_id: parsed.data.tableId,
    action: parsed.data.action,
    status: "PENDING",
    customer_email: parsed.data.customerEmail,
    marketing_opt_in: parsed.data.marketingOptIn,
    session_id: parsed.data.sessionId
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `${ACTION_LABELS[parsed.data.action]} enviado para ${typedTable.table_name}.`
  });
}
