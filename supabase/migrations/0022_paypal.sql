-- Subscriptions through PayPal (new sign-ups); Stripe stays for subscriptions that started there.
-- Run once in Supabase → SQL Editor after 0021_lp_cover.sql. Safe to run again.
alter table public.subscriptions add column if not exists provider text not null default 'stripe';
alter table public.subscriptions add column if not exists paypal_subscription_id text unique;

-- A PayPal subscription cancelled mid-period keeps working until the end of what was paid for
-- (cancel_at_period_end with current_period_end), then stops on its own.
create or replace function public.venue_active(p_venue uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.venue_id = p_venue and s.status in ('trialing', 'active', 'past_due')
      and not (s.cancel_at_period_end and s.current_period_end is not null and s.current_period_end < now())
  );
$$;
grant execute on function public.venue_active(uuid) to anon, authenticated;
