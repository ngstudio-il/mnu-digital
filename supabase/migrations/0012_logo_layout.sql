-- Where the logo sits on the menu header, chosen by dragging it in Settings: {x, y} in percent, size in px.
-- Run once in Supabase → SQL Editor after 0011_menu_design.sql. Safe to run again.
alter table public.venues add column if not exists logo_layout jsonb;
