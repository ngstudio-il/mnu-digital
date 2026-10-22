-- Subscriptions (Stripe): 7-day trial with card on file, then $39/month.
-- Run once in Supabase → SQL Editor after 0002_ai_descriptions.sql.

create table public.subscriptions (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'none',   -- Stripe status: trialing, active, past_due, canceled, unpaid, incomplete…
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

-- Owners can read their subscription. Only the server (service role, via Stripe) writes it.
create policy "owner reads subscription" on public.subscriptions for select using (public.owns_venue(venue_id));

-- A venue is "live" while trialing or paid. past_due keeps working while Stripe retries the card.
create or replace function public.venue_active(p_venue uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.venue_id = p_venue and s.status in ('trialing', 'active', 'past_due'));
$$;
grant execute on function public.venue_active(uuid) to anon, authenticated;

-- AI allowance: 100 a month during the trial, 1,000 once paying.
create or replace function public.venue_ai_limit(p_venue uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.status in ('active', 'past_due') then 1000 when s.status = 'trialing' then 100 else 0 end
                   from public.subscriptions s where s.venue_id = p_venue), 0);
$$;

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
  lim := public.venue_ai_limit(v.id);
  insert into public.ai_usage (venue_id, month, used) values (v.id, m, 0) on conflict do nothing;
  select a.used into cur from public.ai_usage a where a.venue_id = v.id and a.month = m for update;
  if cur >= lim then raise exception 'quota_exceeded'; end if;
  update public.ai_usage a set used = a.used + 1 where a.venue_id = v.id and a.month = m returning a.used into cur;
  return query select cur, lim;
end;
$$;

create or replace function public.ai_quota(p_venue uuid)
returns table (used int, quota int)
language sql stable security definer set search_path = public as $$
  select coalesce((select a.used from public.ai_usage a where a.venue_id = v.id and a.month = to_char(now() at time zone 'utc', 'YYYY-MM')), 0),
         public.venue_ai_limit(v.id)
  from public.venues v where v.id = p_venue and v.owner_id = auth.uid();
$$;

-- Guests can only order from venues with a live subscription.
create or replace function public.place_order(
  p_slug text, p_table text, p_type text, p_name text, p_note text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v public.venues;
  o_id uuid;
  o_number bigint;
  it jsonb;
  d public.dishes;
  q int;
  sum_total numeric(10, 2) := 0;
begin
  select * into v from public.venues where slug = p_slug;
  if v.id is null then raise exception 'Venue not found'; end if;
  if not public.venue_active(v.id) then raise exception 'This menu is not taking orders right now'; end if;
  if not v.ordering_on then raise exception 'This venue is not taking orders right now'; end if;
  if p_type not in ('dinein', 'takeaway') then raise exception 'Invalid order type'; end if;
  if p_type = 'dinein' and not v.dinein then raise exception 'Dine-in orders are off'; end if;
  if p_type = 'takeaway' and not v.takeaway then raise exception 'Takeaway orders are off'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Your order is empty'; end if;

  insert into public.orders (venue_id, table_label, type, customer_name, note)
  values (v.id, left(p_table, 40), p_type, left(p_name, 60), case when v.notes then left(p_note, 300) end)
  returning id, number into o_id, o_number;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into d from public.dishes where id = (it ->> 'dish_id')::uuid and venue_id = v.id and available;
    if d.id is null then raise exception 'A dish in your order is no longer available'; end if;
    q := greatest(1, least(50, coalesce((it ->> 'qty')::int, 1)));
    insert into public.order_items (order_id, dish_id, name, price, qty) values (o_id, d.id, d.name, d.price, q);
    sum_total := sum_total + d.price * q;
  end loop;

  update public.orders set total = sum_total where id = o_id;
  return o_number;
end;
$$;
