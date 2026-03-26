do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.event_action'::regtype
      and enumlabel = 'VIEW_MENU'
  ) then
    alter type public.event_action add value 'VIEW_MENU';
  end if;
end $$;

create or replace function public.create_table_event(
  p_table_id uuid,
  p_session_id uuid,
  p_action public.event_action,
  p_customer_email text,
  p_marketing_opt_in boolean default false
)
returns table(
  ok boolean,
  message text,
  error_code text,
  retry_after_seconds integer,
  table_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_table public.restaurant_tables%rowtype;
  recent_event public.events%rowtype;
begin
  select *
  into active_table
  from public.restaurant_tables
  where id = p_table_id
    and active = true;

  if not found then
    return query
    select false, 'Mesa no disponible', 'TABLE_NOT_FOUND', null::integer, null::text;
    return;
  end if;

  select *
  into recent_event
  from public.events
  where table_id = p_table_id
    and session_id = p_session_id
    and action = p_action
    and created_at >= timezone('utc', now()) - interval '60 seconds'
  order by created_at desc
  limit 1;

  if found then
    return query
    select
      false,
      format(
        'Ya recibimos tu pedido de %s. Esperá un momento para volver a enviarlo.',
        case p_action
          when 'CALL_WAITER'::public.event_action then 'Llamar al mozo'
          when 'REQUEST_BILL'::public.event_action then 'Pedir la cuenta'
          when 'VIEW_MENU'::public.event_action then 'Cliente viendo menú'
        end
      ),
      'COOLDOWN',
      greatest(
        1,
        ceil(
          extract(
            epoch
            from (recent_event.created_at + interval '60 seconds' - timezone('utc', now()))
          )
        )::integer
      ),
      active_table.table_name;
    return;
  end if;

  insert into public.events (
    table_id,
    action,
    status,
    customer_email,
    marketing_opt_in,
    session_id
  )
  values (
    p_table_id,
    p_action,
    'PENDING',
    p_customer_email,
    coalesce(p_marketing_opt_in, false),
    p_session_id
  );

  return query
  select
    true,
    format(
      '%s enviado para %s.',
      case p_action
        when 'CALL_WAITER'::public.event_action then 'Llamar al mozo'
        when 'REQUEST_BILL'::public.event_action then 'Pedir la cuenta'
        when 'VIEW_MENU'::public.event_action then 'Cliente viendo menú'
      end,
      active_table.table_name
    ),
    null::text,
    null::integer,
    active_table.table_name;
end;
$$;

grant execute on function public.create_table_event(uuid, uuid, public.event_action, text, boolean)
to anon, authenticated;
