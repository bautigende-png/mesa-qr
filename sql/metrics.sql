-- 1) Eventos por dia
select
  date_trunc('day', created_at) as day,
  count(*) as total_events,
  count(*) filter (where action = 'CALL_WAITER') as waiter_calls,
  count(*) filter (where action = 'REQUEST_BILL') as bill_requests
from public.events
group by 1
order by 1 desc;

-- 2) Eventos por mesa
select
  t.table_name,
  count(*) as total_events,
  count(*) filter (where e.action = 'CALL_WAITER') as waiter_calls,
  count(*) filter (where e.action = 'REQUEST_BILL') as bill_requests
from public.events e
join public.restaurant_tables t on t.id = e.table_id
group by t.table_name
order by total_events desc, t.table_name asc;

-- 3) Mesas con mas llamados al mozo
select
  t.table_name,
  count(*) as waiter_calls
from public.events e
join public.restaurant_tables t on t.id = e.table_id
where e.action = 'CALL_WAITER'
group by t.table_name
order by waiter_calls desc, t.table_name asc;

-- 4) Tiempo promedio hasta acknowledged
select
  round(
    avg(extract(epoch from (acknowledged_at - created_at))) / 60.0,
    2
  ) as avg_minutes_to_acknowledge
from public.events
where acknowledged_at is not null;

-- 5) Tiempo promedio hasta resolved
select
  round(
    avg(extract(epoch from (resolved_at - created_at))) / 60.0,
    2
  ) as avg_minutes_to_resolve
from public.events
where resolved_at is not null;

-- 6) Tiempo promedio por mesa
select
  t.table_name,
  round(
    avg(extract(epoch from (e.resolved_at - e.created_at))) / 60.0,
    2
  ) as avg_minutes_to_resolve
from public.events e
join public.restaurant_tables t on t.id = e.table_id
where e.resolved_at is not null
group by t.table_name
order by avg_minutes_to_resolve desc nulls last;

-- 7) Estado actual de eventos
select
  status,
  count(*) as total
from public.events
group by status
order by status;

-- 8) Marketing opt-in
select
  count(*) filter (where marketing_opt_in = true) as opted_in,
  count(*) as total_events,
  round(
    100.0 * count(*) filter (where marketing_opt_in = true) / nullif(count(*), 0),
    2
  ) as opt_in_percentage
from public.events;

-- 9) Eventos por franja horaria
select
  extract(hour from created_at) as hour_of_day,
  count(*) as total_events
from public.events
group by 1
order by 1 asc;

-- 10) Eventos de los ultimos 7 dias
select
  date_trunc('day', created_at) as day,
  count(*) as total_events
from public.events
where created_at >= now() - interval '7 days'
group by 1
order by 1 asc;

-- 11) Tiempo promedio de respuesta por accion
select
  action,
  round(
    avg(extract(epoch from (acknowledged_at - created_at))) / 60.0,
    2
  ) as avg_minutes_to_acknowledge,
  round(
    avg(extract(epoch from (resolved_at - created_at))) / 60.0,
    2
  ) as avg_minutes_to_resolve
from public.events
group by action
order by action;

-- 12) Eventos por sector
select
  coalesce(t.sector, 'Sin sector') as sector,
  count(*) as total_events
from public.events e
join public.restaurant_tables t on t.id = e.table_id
group by coalesce(t.sector, 'Sin sector')
order by total_events desc, sector asc;
