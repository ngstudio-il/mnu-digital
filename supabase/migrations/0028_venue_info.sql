-- Business details on the guest menu: phone, address, opening hours, Wi-Fi, a few words about
-- the venue, and whether guests can search the dishes. Shown in the menu header; anyone with
-- the menu link can see them, the Wi-Fi password included.
-- Run once in Supabase → SQL Editor after 0027_admin_venues_free.sql. Safe to run again.
alter table public.venues add column if not exists info jsonb not null default '{}'::jsonb;
