-- Menu import from a photo or PDF: monthly allowance per venue (trial 5, paid 30).
-- Run once in Supabase → SQL Editor after 0003_subscriptions.sql.

alter table public.ai_usage add column if not exists imports int not null default 0;

create or replace function public.venue_import_limit(p_venue uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.status in ('active', 'past_due') then 30 when s.status = 'trialing' then 5 else 0 end
                   from public.subscriptions s where s.venue_id = p_venue), 0);
$$;

create or replace function public.consume_import_credit(p_venue uuid)
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
  lim := public.venue_import_limit(v.id);
  insert into public.ai_usage (venue_id, month, used) values (v.id, m, 0) on conflict do nothing;
  select a.imports into cur from public.ai_usage a where a.venue_id = v.id and a.month = m for update;
  if cur >= lim then raise exception 'quota_exceeded'; end if;
  update public.ai_usage a set imports = a.imports + 1 where a.venue_id = v.id and a.month = m returning a.imports into cur;
  return query select cur, lim;
end;
$$;
revoke all on function public.consume_import_credit(uuid) from public, anon;
grant execute on function public.consume_import_credit(uuid) to authenticated;
