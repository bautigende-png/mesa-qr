import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { hasServiceRoleEnv, isDemoMode } from "@/lib/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

interface RouteProps {
  params: Promise<{ waiterId: string }>;
}

const waiterPermissionSchema = z.object({
  can_manage_direct_order: z.boolean()
});

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const parsed = waiterPermissionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Permiso inválido" }, { status: 400 });
  }

  const { waiterId } = await params;

  if (isDemoMode()) {
    const waiter = getDemoStore().waiters.find((item) => item.id === waiterId);
    if (waiter) {
      waiter.can_manage_direct_order = parsed.data.can_manage_direct_order;
    }
    return NextResponse.json({ success: true, waiter });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ can_manage_direct_order: parsed.data.can_manage_direct_order })
    .eq("id", waiterId)
    .eq("role", "WAITER")
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, waiter: data });
}

export async function DELETE(_: NextRequest, { params }: RouteProps) {
  const { waiterId } = await params;

  if (isDemoMode()) {
    const store = getDemoStore();
    store.waiters = store.waiters.filter((item) => item.id !== waiterId);
    return NextResponse.json({ success: true });
  }

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para eliminar usuarios mozo." },
      { status: 503 }
    );
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(waiterId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
