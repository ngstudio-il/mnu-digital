-- Billing details for invoices (iCount): country, name on the invoice, tax ID, address.
-- Asked for on the billing page before payment; editable in Settings → General.
-- Its own table because venues are publicly readable (the guest menu reads them).
-- Run once in Supabase → SQL Editor after 0024_contact.sql. Safe to run again.
create table if not exists public.billing_profiles (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  country text not null,          -- ISO 3166-1 alpha-2, e.g. US, IL
  name text not null,             -- name on the invoice (business or legal name)
  tax_id text,
  address text,
  updated_at timestamptz not null default now()
);
alter table public.billing_profiles enable row level security;

drop policy if exists "owner reads billing profile" on public.billing_profiles;
create policy "owner reads billing profile" on public.billing_profiles for select using (public.owns_venue(venue_id) or public.is_admin());
drop policy if exists "owner adds billing profile" on public.billing_profiles;
create policy "owner adds billing profile" on public.billing_profiles for insert with check (public.owns_venue(venue_id));
drop policy if exists "owner updates billing profile" on public.billing_profiles;
create policy "owner updates billing profile" on public.billing_profiles for update using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));
