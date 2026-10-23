-- Marketing settings per venue: tracking pixel / tag IDs for the menu page and a popup message for guests.
-- Run once in Supabase → SQL Editor after 0016_lp_drafts.sql. Safe to run again.
alter table public.venues add column if not exists marketing jsonb not null default '{}'::jsonb;
