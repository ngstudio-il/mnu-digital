-- Venues are created right after sign-up with a placeholder name; the owner names the business
-- in the dashboard after paying. setup_done marks that step as done (existing venues: done).
-- Run once in Supabase → SQL Editor after 0017_marketing.sql. Safe to run again.
alter table public.venues add column if not exists setup_done boolean not null default true;
