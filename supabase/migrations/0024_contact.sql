-- Contact form on the home page: each message is kept here (Admin → Inquiries) and emailed to the team.
-- Run once in Supabase → SQL Editor after 0023_payments.sql. Safe to run again.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  business text,
  topic text not null,
  message text not null,
  ip_hash text,
  handled boolean not null default false
);
create index if not exists contact_messages_created on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;

-- Written only by the server (service role); admins read them and mark them handled.
drop policy if exists "admins read contact messages" on public.contact_messages;
create policy "admins read contact messages" on public.contact_messages for select using (public.is_admin());
drop policy if exists "admins update contact messages" on public.contact_messages;
create policy "admins update contact messages" on public.contact_messages for update using (public.is_admin());

-- Live updates for the admin list and its badge.
do $$ begin
  alter publication supabase_realtime add table public.contact_messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;
