-- Try-it page: up to 3 translations of a visitor's draft menu, kept with the draft.
-- Run once in Supabase → SQL Editor after 0019_analytics.sql. Safe to run again.
alter table public.lp_drafts add column if not exists translations jsonb not null default '{}'::jsonb;
