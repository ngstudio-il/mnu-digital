-- One monthly allowance for all AI text: dish descriptions and menu translations.
-- Run once in Supabase → SQL Editor after 0009_translations.sql. Safe to run again.

create or replace function public.consume_ai_credits(p_venue uuid, p_count int)
returns table (used int, quota int)
language plpgsql security definer set search_path = public as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  lim int;
  cur int;
begin
  if not public.owns_venue(p_venue) then raise exception 'not_allowed'; end if;
  if p_count < 1 or p_count > 100 then raise exception 'bad_count'; end if;
  lim := public.venue_ai_limit(p_venue);
  insert into public.ai_usage (venue_id, month, used) values (p_venue, m, 0) on conflict do nothing;
  select a.used into cur from public.ai_usage a where a.venue_id = p_venue and a.month = m for update;
  if cur + p_count > lim then raise exception 'quota_exceeded'; end if;
  update public.ai_usage a set used = a.used + p_count where a.venue_id = p_venue and a.month = m returning a.used into cur;
  return query select cur, lim;
end;
$$;
grant execute on function public.consume_ai_credits(uuid, int) to authenticated;
