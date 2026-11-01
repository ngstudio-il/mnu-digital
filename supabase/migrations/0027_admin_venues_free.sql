-- Admins' own venues work without a subscription (for testing): guests can order from them
-- and the AI allowances are those of the paid plan.
-- Run once in Supabase → SQL Editor after 0026_delivery.sql. Safe to run again.
create or replace function public.venue_owned_by_admin(p_venue uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.venues v
    join auth.users u on u.id = v.owner_id
    join public.admins a on lower(a.email) = lower(u.email)
    where v.id = p_venue and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.venue_owned_by_admin(uuid) from public, anon, authenticated;

create or replace function public.venue_active(p_venue uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.venue_id = p_venue and s.status in ('trialing', 'active', 'past_due')
      and not (s.cancel_at_period_end and s.current_period_end is not null and s.current_period_end < now())
  ) or public.venue_owned_by_admin(p_venue);
$$;
grant execute on function public.venue_active(uuid) to anon, authenticated;

create or replace function public.venue_ai_limit(p_venue uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when public.venue_owned_by_admin(p_venue) then 1000 else
    coalesce((select case when s.status in ('active', 'past_due') then 1000 when s.status = 'trialing' then 100 else 0 end
              from public.subscriptions s where s.venue_id = p_venue), 0) end;
$$;

create or replace function public.venue_image_limit(p_venue uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when public.venue_owned_by_admin(p_venue) then 30 else
    coalesce((select case when s.status in ('active', 'past_due') then 30 when s.status = 'trialing' then 10 else 0 end
              from public.subscriptions s where s.venue_id = p_venue), 0) end;
$$;
