import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";
import { hasServiceRoleEnv } from "@/lib/runtime";

export function createSupabaseAdminClient() {
  if (!hasServiceRoleEnv()) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const serverEnv = getServerEnv();
  return createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
