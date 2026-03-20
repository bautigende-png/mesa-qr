import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile, Role } from "@/lib/types";

export async function requireApiRole(roles: Role[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const typedProfile = (profile as Profile | null) ?? null;

  if (!typedProfile || !roles.includes(typedProfile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return { supabase, session, profile: typedProfile };
}
