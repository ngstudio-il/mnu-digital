-- Menu design: cover photo, design style, font and a custom background colour.
-- Run once in Supabase → SQL Editor after 0010_ai_text_credits.sql. Safe to run again.

alter table public.venues add column if not exists cover_path text;
alter table public.venues add column if not exists theme text not null default 'classic';
alter table public.venues add column if not exists font text;
alter table public.venues add column if not exists bg_color text;
