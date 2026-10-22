-- Admin access, support chat and venue logos.
-- Run once in Supabase → SQL Editor after 0004_menu_import.sql.

-- ---------- Admins ----------
create table public.admins (email text primary key);
alter table public.admins enable row level security;  -- no policies: only the functions below read it
insert into public.admins (email) values ('office@ngstudio.co.il') on conflict do nothing;

-- True when the signed-in user is an admin with a confirmed email address.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u join public.admins a on lower(u.email) = lower(a.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- Admins can act on any venue (support mode). Every owner policy goes through owns_venue().
create or replace function public.owns_venue(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.venues where id = v and owner_id = auth.uid()) or public.is_admin();
$$;

drop policy if exists "owner updates venue" on public.venues;
create policy "owner updates venue" on public.venues for update
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

-- ---------- Venue logo ----------
alter table public.venues add column if not exists logo_path text;

-- ---------- Support chat ----------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  sender text not null check (sender in ('owner', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  read_by_owner boolean not null default false,
  read_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index support_messages_venue_idx on public.support_messages (venue_id, created_at);
alter table public.support_messages enable row level security;

create policy "venue reads support chat" on public.support_messages for select using (public.owns_venue(venue_id));
create policy "owner writes support chat" on public.support_messages for insert with check (
  (sender = 'owner' and exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()))
  or (sender = 'admin' and public.is_admin())
);
create policy "venue marks support chat read" on public.support_messages for update
  using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));

alter publication supabase_realtime add table public.support_messages;

-- ---------- AI allowances also work for admins in support mode ----------
create or replace function public.consume_ai_credit(p_venue uuid)
returns table (used int, quota int)
language plpgsql security definer set search_path = public as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  lim int;
  cur int;
begin
  if not public.owns_venue(p_venue) then raise exception 'not_allowed'; end if;
  lim := public.venue_ai_limit(p_venue);
  insert into public.ai_usage (venue_id, month, used) values (p_venue, m, 0) on conflict do nothing;
  select a.used into cur from public.ai_usage a where a.venue_id = p_venue and a.month = m for update;
  if cur >= lim then raise exception 'quota_exceeded'; end if;
  update public.ai_usage a set used = a.used + 1 where a.venue_id = p_venue and a.month = m returning a.used into cur;
  return query select cur, lim;
end;
$$;

create or replace function public.consume_import_credit(p_venue uuid)
returns table (used int, quota int)
language plpgsql security definer set search_path = public as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  lim int;
  cur int;
begin
  if not public.owns_venue(p_venue) then raise exception 'not_allowed'; end if;
  lim := public.venue_import_limit(p_venue);
  insert into public.ai_usage (venue_id, month, used) values (p_venue, m, 0) on conflict do nothing;
  select a.imports into cur from public.ai_usage a where a.venue_id = p_venue and a.month = m for update;
  if cur >= lim then raise exception 'quota_exceeded'; end if;
  update public.ai_usage a set imports = a.imports + 1 where a.venue_id = p_venue and a.month = m returning a.imports into cur;
  return query select cur, lim;
end;
$$;

create or replace function public.ai_quota(p_venue uuid)
returns table (used int, quota int)
language sql stable security definer set search_path = public as $$
  select coalesce((select a.used from public.ai_usage a where a.venue_id = p_venue and a.month = to_char(now() at time zone 'utc', 'YYYY-MM')), 0),
         public.venue_ai_limit(p_venue)
  where public.owns_venue(p_venue);
$$;
