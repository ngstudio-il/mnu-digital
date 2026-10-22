-- AI dish images: monthly allowance (trial 10, paid 30) plus purchased packs that never expire.
-- Run once in Supabase → SQL Editor after 0007_custom_labels.sql.

alter table public.ai_usage add column if not exists images int not null default 0;
alter table public.dishes add column if not exists image_ai boolean not null default false;  -- true = created from scratch by AI

create table if not exists public.image_credits (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.image_credits enable row level security;
create policy "venue reads image credits" on public.image_credits for select using (public.owns_venue(venue_id));

create table if not exists public.image_purchases (
  stripe_session_id text primary key,
  venue_id uuid not null references public.venues (id) on delete cascade,
  credits int not null,
  amount_cents int not null,
  created_at timestamptz not null default now()
);
alter table public.image_purchases enable row level security;
create policy "venue reads image purchases" on public.image_purchases for select using (public.owns_venue(venue_id));

create or replace function public.venue_image_limit(p_venue uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.status in ('active', 'past_due') then 30 when s.status = 'trialing' then 10 else 0 end
                   from public.subscriptions s where s.venue_id = p_venue), 0);
$$;

-- Uses one image credit: this month's allowance first, then purchased packs.
create or replace function public.consume_image_credit(p_venue uuid)
returns table (used int, quota int, extra int, source text)
language plpgsql security definer set search_path = public as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  lim int;
  cur int;
  bal int;
begin
  if not public.owns_venue(p_venue) then raise exception 'not_allowed'; end if;
  lim := public.venue_image_limit(p_venue);
  insert into public.ai_usage (venue_id, month, used) values (p_venue, m, 0) on conflict do nothing;
  insert into public.image_credits (venue_id) values (p_venue) on conflict do nothing;
  select a.images into cur from public.ai_usage a where a.venue_id = p_venue and a.month = m for update;
  select c.balance into bal from public.image_credits c where c.venue_id = p_venue for update;
  if cur < lim then
    update public.ai_usage a set images = a.images + 1 where a.venue_id = p_venue and a.month = m returning a.images into cur;
    return query select cur, lim, bal, 'monthly'::text;
  elsif bal > 0 then
    update public.image_credits c set balance = c.balance - 1, updated_at = now() where c.venue_id = p_venue returning c.balance into bal;
    return query select cur, lim, bal, 'pack'::text;
  else
    raise exception 'quota_exceeded';
  end if;
end;
$$;
revoke all on function public.consume_image_credit(uuid) from public, anon;
grant execute on function public.consume_image_credit(uuid) to authenticated;

-- Gives a credit back when generation fails. Server only (service role).
create or replace function public.refund_image_credit(p_venue uuid, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_source = 'pack' then
    update public.image_credits set balance = balance + 1, updated_at = now() where venue_id = p_venue;
  else
    update public.ai_usage set images = greatest(0, images - 1) where venue_id = p_venue and month = to_char(now() at time zone 'utc', 'YYYY-MM');
  end if;
end;
$$;
revoke all on function public.refund_image_credit(uuid, text) from public, anon, authenticated;

-- Adds a purchased pack once per Stripe checkout session. Server only (service role).
create or replace function public.grant_image_pack(p_session text, p_venue uuid, p_credits int, p_amount int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.image_purchases (stripe_session_id, venue_id, credits, amount_cents) values (p_session, p_venue, p_credits, p_amount);
  insert into public.image_credits (venue_id, balance) values (p_venue, p_credits)
    on conflict (venue_id) do update set balance = public.image_credits.balance + p_credits, updated_at = now();
  return true;
exception when unique_violation then
  return false;  -- already granted
end;
$$;
revoke all on function public.grant_image_pack(text, uuid, int, int) from public, anon, authenticated;

create or replace function public.image_quota(p_venue uuid)
returns table (used int, quota int, extra int)
language sql stable security definer set search_path = public as $$
  select coalesce((select a.images from public.ai_usage a where a.venue_id = p_venue and a.month = to_char(now() at time zone 'utc', 'YYYY-MM')), 0),
         public.venue_image_limit(p_venue),
         coalesce((select c.balance from public.image_credits c where c.venue_id = p_venue), 0)
  where public.owns_venue(p_venue);
$$;
grant execute on function public.image_quota(uuid) to authenticated;
