-- Menu languages: a main language plus automatic AI translations.
-- Run once in Supabase → SQL Editor after 0008_ai_images.sql. Safe to run again.

alter table public.venues add column if not exists primary_lang text not null default 'en';

-- One row per translated dish, category or label. `src` is the original text it was made from,
-- so a change to the dish shows the translation is out of date.
create table if not exists public.menu_translations (
  venue_id uuid not null references public.venues (id) on delete cascade,
  lang text not null,
  key text not null,
  name text not null default '',
  description text not null default '',
  src text not null default '',
  updated_at timestamptz not null default now(),
  primary key (venue_id, lang, key)
);
alter table public.menu_translations enable row level security;
drop policy if exists "translations are public" on public.menu_translations;
create policy "translations are public" on public.menu_translations for select using (true);
drop policy if exists "owner manages translations" on public.menu_translations;
create policy "owner manages translations" on public.menu_translations for all
  using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));

-- Buttons and labels of the guest menu per language, shared by every venue. Written by the server only.
create table if not exists public.ui_translations (
  lang text primary key,
  version int not null,
  strings jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.ui_translations enable row level security;
drop policy if exists "ui translations are public" on public.ui_translations;
create policy "ui translations are public" on public.ui_translations for select using (true);
