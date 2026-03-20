alter table public.settings
  add column if not exists direct_order_url text,
  add column if not exists logo_url text,
  add column if not exists mobile_banner_url text,
  add column if not exists mobile_banner_text text,
  add column if not exists custom_message text,
  add column if not exists brand_primary_color text not null default '#0f172a',
  add column if not exists brand_secondary_color text not null default '#b45309',
  add column if not exists brand_tertiary_color text not null default '#f8f5ef';
