-- The venue's time zone (Settings → General), used for "today" on the dashboard.
-- Run once in Supabase → SQL Editor after 0013_menu_visibility.sql. Safe to run again.
alter table public.venues add column if not exists timezone text;
