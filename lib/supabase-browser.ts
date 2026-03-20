"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import { hasBrowserSupabaseEnv } from "@/lib/runtime";

export function createSupabaseBrowserClient() {
  if (!hasBrowserSupabaseEnv()) {
    return null;
  }

  const publicEnv = getPublicEnv();
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
