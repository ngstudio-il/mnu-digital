-- Lets guests see the orders they placed (and their live status) without exposing anyone else's.
-- Run once in Supabase → SQL Editor after 0005_admin_support_logo.sql.

alter table public.orders add column if not exists guest_token uuid not null default gen_random_uuid();
create unique index if not exists orders_guest_token_idx on public.orders (guest_token);

-- Same as place_order, but also returns a private token the guest's phone keeps to look the order up.
create or replace function public.place_order_v2(
  p_slug text, p_table text, p_type text, p_name text, p_note text, p_items jsonb
) returns json
language plpgsql security definer set search_path = public as $$
declare
  n bigint;
  t uuid;
begin
  n := public.place_order(p_slug, p_table, p_type, p_name, p_note, p_items);
  select guest_token into t from public.orders where number = n;
  return json_build_object('number', n, 'token', t);
end;
$$;
grant execute on function public.place_order_v2(text, text, text, text, text, jsonb) to anon, authenticated;

-- Returns only the orders whose tokens the guest holds.
create or replace function public.guest_orders(p_tokens uuid[])
returns table (token uuid, number bigint, status text, total numeric, table_label text, type text, created_at timestamptz, items json)
language sql stable security definer set search_path = public as $$
  select o.guest_token, o.number, o.status, o.total, o.table_label, o.type, o.created_at,
         coalesce((select json_agg(json_build_object('name', i.name, 'qty', i.qty, 'price', i.price)) from public.order_items i where i.order_id = o.id), '[]'::json)
  from public.orders o
  where o.guest_token = any(p_tokens[1:20])
  order by o.created_at desc;
$$;
grant execute on function public.guest_orders(uuid[]) to anon, authenticated;
