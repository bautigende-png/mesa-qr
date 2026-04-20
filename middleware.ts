import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import { hasSupabaseEnv } from "@/lib/runtime";
import type { Profile } from "@/lib/types";

export async function middleware(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
  }

  const publicEnv = getPublicEnv();
  type CookieMutation = {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  };

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieMutation[]) {
          cookiesToSet.forEach(({ name, value, options }: CookieMutation) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isWaiterPath = pathname.startsWith("/waiter") || pathname.startsWith("/api/waiter");

  if (!isAdminPath && !isWaiterPath) {
    await supabase.auth.getUser();
    return response;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = (profile as Profile | null) ?? null;

  if (!typedProfile) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/api/admin") && typedProfile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pathname.startsWith("/api/waiter") && !["WAITER", "ADMIN"].includes(typedProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pathname.startsWith("/admin") && typedProfile.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/waiter", request.url));
  }

  if (pathname.startsWith("/waiter") && !["WAITER", "ADMIN"].includes(typedProfile.role)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/waiter/:path*"]
};
