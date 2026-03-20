import { NextRequest, NextResponse } from "next/server";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { hasServiceRoleEnv, isDemoMode } from "@/lib/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

interface RouteProps {
  params: Promise<{ waiterId: string }>;
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
