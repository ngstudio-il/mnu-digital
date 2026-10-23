-- Try-it page: an AI cover photo of one of the visitor's dishes, kept with the draft
-- (and used as the venue's cover after sign-up).
-- Run once in Supabase → SQL Editor after 0020_lp_translations.sql. Safe to run again.
alter table public.lp_drafts add column if not exists cover_path text;
alter table public.lp_drafts add column if not exists cover_dish text;
