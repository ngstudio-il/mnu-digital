-- AI dish descriptions: monthly quota per venue (free 100, paid 1000).
-- Run once in Supabase → SQL Editor after 0001_init.sql.

create table public.ai_usage (
  venue_id uuid not null references public.venues (id) on delete cascade,
  month text not null,            -- 'YYYY-MM' in UTC
  used int not null default 0,
  primary key (venue_id, month)
);
alter table public.ai_usage enable row level security;

-- Owners can see their usage; nobody can write to it directly (only through the function below).
create policy "owner reads ai usage" on public.ai_usage for select using (public.owns_venue(venue_id));

create or replace function public.ai_limit(p_plan text) returns int
language sql immutable as $$ select case when p_plan = 'free' then 100 else 1000 end $$;

-- Uses one credit for the caller's venue, or raises 'quota_exceeded'. Returns used / limit after the call.
create or replace function public.consume_ai_credit(p_venue uuid)
returns table (used int, quota int)
language plpgsql security definer set search_path = public as $$
declare
  v public.venues;
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  lim int;
  cur int;
begin
  select * into v from public.venues where id = p_venue and owner_id = auth.uid();
  if v.id is null then raise exception 'not_allowed'; end if;
  lim := public.ai_limit(v.plan);
  insert into public.ai_usage (venue_id, month, used) values (v.id, m, 0) on conflict do nothing;
  select a.used into cur from public.ai_usage a where a.venue_id = v.id and a.month = m for update;
  if cur >= lim then raise exception 'quota_exceeded'; end if;
  update public.ai_usage a set used = a.used + 1 where a.venue_id = v.id and a.month = m returning a.used into cur;
  return query select cur, lim;
end;
$$;
revoke all on function public.consume_ai_credit(uuid) from public, anon;
grant execute on function public.consume_ai_credit(uuid) to authenticated;

-- Read-only view of this month's usage for the dashboard.
create or replace function public.ai_quota(p_venue uuid)
returns table (used int, quota int)
language sql stable security definer set search_path = public as $$
  select coalesce((select a.used from public.ai_usage a where a.venue_id = v.id and a.month = to_char(now() at time zone 'utc', 'YYYY-MM')), 0),
         public.ai_limit(v.plan)
  from public.venues v where v.id = p_venue and v.owner_id = auth.uid();
$$;
grant execute on function public.ai_quota(uuid) to authenticated;
