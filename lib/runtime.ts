export function hasSupabaseEnv() {
  return hasBrowserSupabaseEnv();
}

export function isDemoMode() {
  return !hasSupabaseEnv();
}

export function hasBrowserSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasServiceRoleEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
