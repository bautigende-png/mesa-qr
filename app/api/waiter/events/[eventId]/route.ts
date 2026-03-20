import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isDemoMode } from "@/lib/runtime";

const statusSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED"])
});

interface RouteProps {
  params: Promise<{ eventId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const { eventId } = await params;

  if (isDemoMode()) {
    const event = getDemoStore().events.find((item) => item.id === eventId);

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    event.status = parsed.data.status;
    event.updated_at = new Date().toISOString();
    if (parsed.data.status === "ACKNOWLEDGED") {
      event.acknowledged_at = new Date().toISOString();
    } else {
      event.resolved_at = new Date().toISOString();
    }

    return NextResponse.json({ success: true });
  }

  const auth = await requireApiRole(["WAITER", "ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const admin = createSupabaseAdminClient();
  const payload =
    parsed.data.status === "ACKNOWLEDGED"
      ? { status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString() }
      : { status: "RESOLVED", resolved_at: new Date().toISOString() };

  const { error } = await admin.from("events").update(payload).eq("id", eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
