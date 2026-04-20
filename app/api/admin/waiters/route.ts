import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { hasServiceRoleEnv, isDemoMode } from "@/lib/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Profile } from "@/lib/types";

const waiterSchema = z.object({
  full_name: z.string().trim().optional().default(""),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8)
});

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ waiters: getDemoStore().waiters });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("*")
    .eq("role", "WAITER")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ waiters: ((data as Profile[] | null) ?? []) });
}

export async function POST(request: NextRequest) {
  const parsed = waiterSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá el email y usá una contraseña de al menos 8 caracteres." },
      { status: 400 }
    );
  }

  if (isDemoMode()) {
    const waiter = {
      id: crypto.randomUUID(),
      email: parsed.data.email,
      full_name: parsed.data.full_name || null,
      role: "WAITER" as const,
      can_manage_direct_order: false,
      created_at: new Date().toISOString()
    };
    getDemoStore().waiters.unshift(waiter);
    return NextResponse.json({ success: true, waiter });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para crear usuarios mozo." },
      { status: 503 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: "WAITER",
      can_manage_direct_order: false
    }
  });

  if (error || !data.user) {
    const message = error?.message ?? "No se pudo crear el usuario";
    const isDuplicate = message.toLowerCase().includes("already") || message.toLowerCase().includes("registered");

    return NextResponse.json(
      {
        error: isDuplicate
          ? "Ya existe un usuario con ese email."
          : message
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    email: parsed.data.email,
    full_name: parsed.data.full_name || null,
    role: "WAITER",
    can_manage_direct_order: false
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    waiter: {
      id: data.user.id,
      email: parsed.data.email,
      full_name: parsed.data.full_name || null,
      role: "WAITER",
      can_manage_direct_order: false
    }
  });
}
