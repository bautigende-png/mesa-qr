import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile, Role } from "@/lib/types";

export async function getSessionProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return { session: null, profile: null as Profile | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  return { session, profile: (profile as Profile | null) ?? null };
}

export async function requireRole(roles: Role[]) {
  const { session, profile } = await getSessionProfile();

  if (!session || !profile || !roles.includes(profile.role)) {
    redirect(roles.includes("ADMIN") ? "/admin" : "/waiter");
  }

  return { session, profile };
}
