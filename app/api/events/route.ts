import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ACTION_LABELS, EVENT_COOLDOWN_MS } from "@/lib/constants";
import { getDemoStore } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/runtime";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const createEventSchema = z.object({
  tableId: z.string().uuid(),
  sessionId: z.string().uuid(),
  action: z.enum(["CALL_WAITER", "REQUEST_BILL", "VIEW_MENU"]),
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_table_event", {
    p_action: parsed.data.action,
    p_customer_email: parsed.data.customerEmail,
    p_marketing_opt_in: parsed.data.marketingOptIn,
    p_session_id: parsed.data.sessionId,
    p_table_id: parsed.data.tableId
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result =
    (
      (Array.isArray(data) ? data[0] : data) as
        | {
            ok: boolean;
            message: string | null;
            error_code: string | null;
            retry_after_seconds: number | null;
            table_name: string | null;
          }
        | null
    ) ?? null;

  if (!result) {
    return NextResponse.json({ error: "No se pudo crear el evento" }, { status: 500 });
  }

  if (!result.ok) {
    if (result.error_code === "TABLE_NOT_FOUND") {
      return NextResponse.json({ error: "Mesa no disponible" }, { status: 404 });
    }

    if (result.error_code === "COOLDOWN") {
      return NextResponse.json(
        {
          error: result.message ?? `Ya recibimos tu pedido de ${ACTION_LABELS[parsed.data.action]}. Esperá un momento para volver a enviarlo.`,
          retryAfterSeconds: result.retry_after_seconds ?? Math.ceil(EVENT_COOLDOWN_MS / 1000)
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: result.message ?? "No se pudo crear el evento" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message:
      result.message ??
      `${ACTION_LABELS[parsed.data.action]} enviado para ${result.table_name ?? "la mesa"}.`
  });
}
