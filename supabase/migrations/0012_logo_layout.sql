-- How the logo sits inside its frame, set in Settings: {zoom, x, y} (x and y in percent of the frame).
-- Run once in Supabase → SQL Editor after 0011_menu_design.sql. Safe to run again.
alter table public.venues add column if not exists logo_layout jsonb;
