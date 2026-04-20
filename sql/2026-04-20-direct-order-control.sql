alter table public.profiles
add column if not exists can_manage_direct_order boolean not null default false;

alter table public.settings
add column if not exists direct_order_enabled boolean not null default false;
