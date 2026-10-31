-- Every payment received (PayPal or Stripe), one row each: the list to invoice from (iCount),
-- and what keeps a payment alert from being emailed twice when PayPal resends a webhook.
-- Run once in Supabase → SQL Editor after 0022_paypal.sql. Safe to run again.
create table if not exists public.payments (
  id text primary key,                 -- provider:transaction id
  venue_id uuid references public.venues (id) on delete set null,
  provider text not null,
  kind text not null,                  -- subscription | image_pack
  amount numeric(10, 2) not null,
  currency text not null,
  payer_name text,
  payer_email text,
  paid_at timestamptz not null default now(),
  invoiced boolean not null default false
);
alter table public.payments enable row level security;
-- No policies: only the server (service role) reads and writes payments.
