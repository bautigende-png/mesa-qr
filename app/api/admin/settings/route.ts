import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDemoStore } from "@/lib/demo-store";
import { requireApiRole } from "@/lib/api";
import { isDemoMode } from "@/lib/runtime";
import type { Settings } from "@/lib/types";

const settingsSchema = z.object({
  restaurant_name: z.string().min(1),
  global_menu_url: z.string().url().nullable().optional().or(z.literal("")),
  direct_order_url: z.string().url().nullable().optional().or(z.literal("")),
  direct_order_enabled: z.boolean().optional().default(false),
  logo_url: z.string().url().nullable().optional().or(z.literal("")),
  mobile_banner_url: z.string().url().nullable().optional().or(z.literal("")),
  mobile_banner_text: z.string().nullable().optional().or(z.literal("")),
  custom_message: z.string().nullable().optional().or(z.literal("")),
  brand_primary_color: z.string().regex(/^#([0-9A-Fa-f]{6})$/),
  brand_secondary_color: z.string().regex(/^#([0-9A-Fa-f]{6})$/),
  brand_tertiary_color: z.string().regex(/^#([0-9A-Fa-f]{6})$/),
  id: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ settings: getDemoStore().settings });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data as Settings });
}

export async function PATCH(request: NextRequest) {
  const raw = (await request.json().catch(() => null)) as {
    restaurant_name?: string;
    global_menu_url?: string | null;
    direct_order_url?: string | null;
    direct_order_enabled?: boolean;
    logo_url?: string | null;
    mobile_banner_url?: string | null;
    mobile_banner_text?: string | null;
    custom_message?: string | null;
    brand_primary_color?: string;
    brand_secondary_color?: string;
    brand_tertiary_color?: string;
  } | null;

  const parsed = settingsSchema.safeParse({
    restaurant_name: raw?.restaurant_name,
    global_menu_url: raw?.global_menu_url || null,
    direct_order_url: raw?.direct_order_url || null,
    direct_order_enabled: raw?.direct_order_enabled ?? false,
    logo_url: raw?.logo_url || null,
    mobile_banner_url: raw?.mobile_banner_url || null,
    mobile_banner_text: raw?.mobile_banner_text || null,
    custom_message: raw?.custom_message || null,
    brand_primary_color: raw?.brand_primary_color,
    brand_secondary_color: raw?.brand_secondary_color,
    brand_tertiary_color: raw?.brand_tertiary_color
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (isDemoMode()) {
    Object.assign(getDemoStore().settings, {
      restaurant_name: parsed.data.restaurant_name,
      global_menu_url: parsed.data.global_menu_url || null,
      direct_order_url: parsed.data.direct_order_url || null,
      direct_order_enabled: parsed.data.direct_order_enabled,
      logo_url: parsed.data.logo_url || null,
      mobile_banner_url: parsed.data.mobile_banner_url || null,
      mobile_banner_text: parsed.data.mobile_banner_text || null,
      custom_message: parsed.data.custom_message || null,
      brand_primary_color: parsed.data.brand_primary_color,
      brand_secondary_color: parsed.data.brand_secondary_color,
      brand_tertiary_color: parsed.data.brand_tertiary_color,
      updated_at: new Date().toISOString()
    });
    return NextResponse.json({ success: true });
  }

  const auth = await requireApiRole(["ADMIN"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { error } = await auth.supabase
    .from("settings")
    .update({
      restaurant_name: parsed.data.restaurant_name,
      global_menu_url: parsed.data.global_menu_url || null,
      direct_order_url: parsed.data.direct_order_url || null,
      direct_order_enabled: parsed.data.direct_order_enabled,
      logo_url: parsed.data.logo_url || null,
      mobile_banner_url: parsed.data.mobile_banner_url || null,
      mobile_banner_text: parsed.data.mobile_banner_text || null,
      custom_message: parsed.data.custom_message || null,
      brand_primary_color: parsed.data.brand_primary_color,
      brand_secondary_color: parsed.data.brand_secondary_color,
      brand_tertiary_color: parsed.data.brand_tertiary_color
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
