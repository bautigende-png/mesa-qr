import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const publicEnv = getPublicEnv();
  const cookieStore = await cookies();
  type CookieMutation = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieMutation[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieMutation) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can read auth cookies even when they cannot write them.
          }
        }
      }
    }
  );
}
