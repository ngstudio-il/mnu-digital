-- Menu analytics: anonymous view events from the guest menu, live presence, and one call that
-- returns everything the Analytics page shows.
-- Run once in Supabase → SQL Editor after 0018_venue_setup.sql. Safe to run again.

create table if not exists public.menu_events (
  id bigserial primary key,
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind text not null check (kind in ('view', 'dish')),
  dish_id uuid,
  visitor text not null,
  lang text,
  created_at timestamptz not null default now()
);
create index if not exists menu_events_venue_time_idx on public.menu_events (venue_id, created_at);
alter table public.menu_events enable row level security; -- no policies: written and read through the functions below

create table if not exists public.menu_presence (
  venue_id uuid not null references public.venues (id) on delete cascade,
  visitor text not null,
  last_seen timestamptz not null default now(),
  primary key (venue_id, visitor)
);
alter table public.menu_presence enable row level security;

-- Guests (anonymous) record a menu view or a dish being opened. The visitor id is random, kept on the phone.
create or replace function public.log_menu_event(p_venue uuid, p_kind text, p_dish uuid, p_visitor text, p_lang text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('view', 'dish') or p_visitor is null or length(p_visitor) not between 8 and 64 then return; end if;
  if not exists (select 1 from public.venues where id = p_venue) then return; end if;
  if p_dish is not null and not exists (select 1 from public.dishes where id = p_dish and venue_id = p_venue) then return; end if;
  -- Guard against floods from one visitor.
  if (select count(*) from public.menu_events where venue_id = p_venue and visitor = p_visitor and created_at > now() - interval '1 day') >= 300 then return; end if;
  insert into public.menu_events (venue_id, kind, dish_id, visitor, lang) values (p_venue, p_kind, p_dish, p_visitor, left(p_lang, 12));
end;
$$;
grant execute on function public.log_menu_event(uuid, text, uuid, text, text) to anon, authenticated;

-- "I'm still here" from an open menu, every ~25 seconds.
create or replace function public.menu_ping(p_venue uuid, p_visitor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_visitor is null or length(p_visitor) not between 8 and 64 then return; end if;
  if not exists (select 1 from public.venues where id = p_venue) then return; end if;
  insert into public.menu_presence (venue_id, visitor, last_seen) values (p_venue, p_visitor, now())
  on conflict (venue_id, visitor) do update set last_seen = now();
  if random() < 0.02 then delete from public.menu_presence where venue_id = p_venue and last_seen < now() - interval '1 hour'; end if;
end;
$$;
grant execute on function public.menu_ping(uuid, text) to anon, authenticated;

-- How many people have the menu open right now (owner only).
create or replace function public.menu_now(p_venue uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when public.owns_venue(p_venue) then (select count(*)::int from public.menu_presence where venue_id = p_venue and last_seen > now() - interval '70 seconds') end;
$$;
grant execute on function public.menu_now(uuid) to authenticated;

-- Everything for the Analytics page, for [p_from, p_to) in the venue's time zone (owner only).
create or replace function public.venue_analytics(p_venue uuid, p_from timestamptz, p_to timestamptz, p_tz text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz text := coalesce((select name from pg_timezone_names where name = p_tz limit 1), 'UTC');
begin
  if not public.owns_venue(p_venue) then return null; end if;
  return (
    with ev as (select * from public.menu_events where venue_id = p_venue and created_at >= p_from and created_at < p_to),
         od as (select * from public.orders where venue_id = p_venue and created_at >= p_from and created_at < p_to and status <> 'cancelled')
    select jsonb_build_object(
      'views', (select count(*) from ev where kind = 'view'),
      'visitors', (select count(distinct visitor) from ev where kind = 'view'),
      'dish_views', (select count(*) from ev where kind = 'dish'),
      'orders', (select count(*) from od),
      'revenue', (select coalesce(sum(total), 0) from od),
      'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'views', v, 'visitors', u) order by d), '[]'::jsonb)
                from (select (created_at at time zone tz)::date as d, count(*) as v, count(distinct visitor) as u from ev where kind = 'view' group by 1) x),
      'hourly', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'views', v) order by h), '[]'::jsonb)
                 from (select extract(hour from created_at at time zone tz)::int as h, count(*) as v from ev where kind = 'view' group by 1) x),
      'orders_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'orders', n, 'revenue', r) order by d), '[]'::jsonb)
                       from (select (created_at at time zone tz)::date as d, count(*) as n, sum(total) as r from od group by 1) x),
      'top_viewed', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'views', v) order by v desc), '[]'::jsonb)
                     from (select d.name, count(*) as v from ev join public.dishes d on d.id = ev.dish_id where ev.kind = 'dish' group by d.name order by v desc limit 8) x),
      'top_ordered', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', q, 'revenue', r) order by q desc), '[]'::jsonb)
                      from (select i.name, sum(i.qty) as q, sum(i.qty * i.price) as r from public.order_items i join od on od.id = i.order_id group by i.name order by q desc limit 8) x),
      'langs', (select coalesce(jsonb_agg(jsonb_build_object('lang', l, 'views', v) order by v desc), '[]'::jsonb)
                from (select coalesce(lang, '?') as l, count(*) as v from ev where kind = 'view' group by 1 order by v desc limit 6) x)
    )
  );
end;
$$;
grant execute on function public.venue_analytics(uuid, timestamptz, timestamptz, text) to authenticated;
