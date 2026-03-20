insert into public.settings (
  id,
  restaurant_name,
  global_menu_url,
  direct_order_url,
  logo_url,
  mobile_banner_url,
  mobile_banner_text,
  custom_message,
  brand_primary_color,
  brand_secondary_color,
  brand_tertiary_color
)
values (
  1,
  'Bistró Central',
  'https://pedidos.example.com/menu',
  'https://pedidos.example.com/directo',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
  'Promo almuerzo ejecutivo de lunes a viernes',
  'Consultá por nuestro menú del día y beneficios para mesas grandes.',
  '#0f172a',
  '#b45309',
  '#f8f5ef'
)
on conflict (id) do update set
  restaurant_name = excluded.restaurant_name,
  global_menu_url = excluded.global_menu_url,
  direct_order_url = excluded.direct_order_url,
  logo_url = excluded.logo_url,
  mobile_banner_url = excluded.mobile_banner_url,
  mobile_banner_text = excluded.mobile_banner_text,
  custom_message = excluded.custom_message,
  brand_primary_color = excluded.brand_primary_color,
  brand_secondary_color = excluded.brand_secondary_color,
  brand_tertiary_color = excluded.brand_tertiary_color;

insert into public.restaurant_tables (id, table_name, active, sector, ordering_url, menu_url_override)
values
  ('11111111-1111-1111-1111-111111111111', 'Mesa 1', true, 'Salón', 'https://pedidos.example.com/mesa-1', null),
  ('22222222-2222-2222-2222-222222222222', 'Mesa 2', true, 'Ventana', 'https://pedidos.example.com/mesa-2', null),
  ('33333333-3333-3333-3333-333333333333', 'Barra 1', true, 'Barra', 'https://pedidos.example.com/barra-1', 'https://menu.example.com/barra')
on conflict (id) do update set
  table_name = excluded.table_name,
  active = excluded.active,
  sector = excluded.sector,
  ordering_url = excluded.ordering_url,
  menu_url_override = excluded.menu_url_override;

-- Bootstrap admin after creating the first auth user:
-- update public.profiles
-- set role = 'ADMIN'
-- where email = 'admin@restaurant.com';
