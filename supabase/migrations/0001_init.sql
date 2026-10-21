-- mnu.digital initial schema
-- Run once in Supabase → SQL Editor (or with the Supabase CLI: supabase db push).

-- ---------- Tables ----------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null unique,
  type text not null default 'Restaurant',
  currency text not null default '$',
  brand text not null default '#1f2829',
  langs text[] not null default '{en}',
  tables int not null default 10 check (tables between 1 and 200),
  ordering_on boolean not null default true,
  dinein boolean not null default true,
  takeaway boolean not null default true,
  notes boolean not null default true,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);
create index venues_owner_idx on public.venues (owner_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_venue_idx on public.categories (venue_id);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0 check (price >= 0),
  image_path text,
  available boolean not null default true,
  tags text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index dishes_venue_idx on public.dishes (venue_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  venue_id uuid not null references public.venues (id) on delete cascade,
  table_label text,
  type text not null default 'dinein' check (type in ('dinein', 'takeaway')),
  customer_name text,
  note text,
  status text not null default 'new' check (status in ('new', 'preparing', 'ready', 'done', 'cancelled')),
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index orders_venue_idx on public.orders (venue_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  dish_id uuid references public.dishes (id) on delete set null,
  name text not null,
  price numeric(10, 2) not null,
  qty int not null check (qty between 1 and 50)
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------- Row level security ----------
alter table public.venues enable row level security;
alter table public.categories enable row level security;
alter table public.dishes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create or replace function public.owns_venue(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.venues where id = v and owner_id = auth.uid());
$$;

-- Venues: anyone can read (the public menu needs name, brand, etc.); only the owner can change.
create policy "venues are public" on public.venues for select using (true);
create policy "owner inserts venue" on public.venues for insert with check (owner_id = auth.uid());
create policy "owner updates venue" on public.venues for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes venue" on public.venues for delete using (owner_id = auth.uid());

-- Categories and dishes: public read, owner write.
create policy "categories are public" on public.categories for select using (true);
create policy "owner manages categories" on public.categories for all using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));
create policy "dishes are public" on public.dishes for select using (true);
create policy "owner manages dishes" on public.dishes for all using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));

-- Orders: only the owner reads and updates. Guests create orders through place_order() below.
create policy "owner reads orders" on public.orders for select using (public.owns_venue(venue_id));
create policy "owner updates orders" on public.orders for update using (public.owns_venue(venue_id)) with check (public.owns_venue(venue_id));
create policy "owner reads order items" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and public.owns_venue(o.venue_id)));

-- ---------- Guest ordering ----------
-- items: [{"dish_id": "...", "qty": 2}, ...]. Prices are taken from the database, never from the guest.
create or replace function public.place_order(
  p_slug text, p_table text, p_type text, p_name text, p_note text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v public.venues;
  o_id uuid;
  o_number bigint;
  it jsonb;
  d public.dishes;
  q int;
  sum_total numeric(10, 2) := 0;
begin
  select * into v from public.venues where slug = p_slug;
  if v.id is null then raise exception 'Venue not found'; end if;
  if not v.ordering_on then raise exception 'This venue is not taking orders right now'; end if;
  if p_type not in ('dinein', 'takeaway') then raise exception 'Invalid order type'; end if;
  if p_type = 'dinein' and not v.dinein then raise exception 'Dine-in orders are off'; end if;
  if p_type = 'takeaway' and not v.takeaway then raise exception 'Takeaway orders are off'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Your order is empty'; end if;

  insert into public.orders (venue_id, table_label, type, customer_name, note)
  values (v.id, left(p_table, 40), p_type, left(p_name, 60), case when v.notes then left(p_note, 300) end)
  returning id, number into o_id, o_number;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into d from public.dishes where id = (it ->> 'dish_id')::uuid and venue_id = v.id and available;
    if d.id is null then raise exception 'A dish in your order is no longer available'; end if;
    q := greatest(1, least(50, coalesce((it ->> 'qty')::int, 1)));
    insert into public.order_items (order_id, dish_id, name, price, qty) values (o_id, d.id, d.name, d.price, q);
    sum_total := sum_total + d.price * q;
  end loop;

  update public.orders set total = sum_total where id = o_id;
  return o_number;
end;
$$;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;

-- ---------- Realtime: new orders appear instantly in the dashboard ----------
alter publication supabase_realtime add table public.orders;

-- ---------- Storage: dish photos ----------
insert into storage.buckets (id, name, public) values ('dish-photos', 'dish-photos', true)
on conflict (id) do nothing;

-- Files live under <venue_id>/<file>; only that venue's owner may write there.
create policy "dish photos are public" on storage.objects for select using (bucket_id = 'dish-photos');
create policy "owner uploads dish photos" on storage.objects for insert
  with check (bucket_id = 'dish-photos' and public.owns_venue(((storage.foldername(name))[1])::uuid));
create policy "owner updates dish photos" on storage.objects for update
  using (bucket_id = 'dish-photos' and public.owns_venue(((storage.foldername(name))[1])::uuid));
create policy "owner deletes dish photos" on storage.objects for delete
  using (bucket_id = 'dish-photos' and public.owns_venue(((storage.foldername(name))[1])::uuid));
