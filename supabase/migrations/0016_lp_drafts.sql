-- Menus read on the public try-it page (lp.mnu.digital), kept until the visitor signs up and claims them.
-- Run once in Supabase → SQL Editor after 0015_variations_optional_price.sql. Safe to run again.
create table if not exists public.lp_drafts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  currency text,
  sections jsonb not null default '[]'::jsonb,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lp_drafts_ip_idx on public.lp_drafts (ip_hash, created_at);
-- No policies: only the server (service role) reads and writes drafts.
alter table public.lp_drafts enable row level security;
