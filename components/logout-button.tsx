"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <button className="button-secondary" disabled={loading} onClick={handleLogout}>
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
