import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiRole } from "@/lib/api";
import { getDemoStore } from "@/lib/demo-store";
import { hasServiceRoleEnv, isDemoMode } from "@/lib/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const directOrderSchema = z.object({
  enabled: z.boolean()
});

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({
      direct_order_enabled: getDemoStore().settings.direct_order_enabled
    });
  }

  const auth = await requireApiRole(["WAITER", "ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("settings")
    .select("direct_order_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    direct_order_enabled: Boolean(data?.direct_order_enabled)
  });
}

export async function PATCH(request: NextRequest) {
  const parsed = directOrderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  if (isDemoMode()) {
    getDemoStore().settings.direct_order_enabled = parsed.data.enabled;
    return NextResponse.json({
      success: true,
      direct_order_enabled: parsed.data.enabled
    });
  }

  const auth = await requireApiRole(["WAITER", "ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  if (auth.profile.role !== "ADMIN" && !auth.profile.can_manage_direct_order) {
    return NextResponse.json(
      { error: "No tenés permiso para administrar Pedí directo." },
      { status: 403 }
    );
  }

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para cambiar Pedí directo." },
      { status: 503 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("settings")
    .update({ direct_order_enabled: parsed.data.enabled })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    direct_order_enabled: parsed.data.enabled
  });
}
