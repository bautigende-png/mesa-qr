import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile, Role } from "@/lib/types";

export async function requireApiRole(roles: Role[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = (profile as Profile | null) ?? null;

  if (!typedProfile || !roles.includes(typedProfile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return { supabase, session: user, profile: typedProfile };
}
