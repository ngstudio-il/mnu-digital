-- Delivery orders, and the guest's phone number.
-- Venues choose: delivery on/off, and whether guests give a phone number (off / optional / required).
-- Delivery orders always need a phone number and an address (from Google Maps when it's set up).
-- Run once in Supabase → SQL Editor after 0025_billing_profiles.sql. Safe to run again.
alter table public.venues add column if not exists delivery boolean not null default false;
alter table public.venues add column if not exists ask_phone text not null default 'off';
do $$ begin
  alter table public.venues add constraint venues_ask_phone_check check (ask_phone in ('off', 'optional', 'required'));
exception when duplicate_object then null;
end $$;

alter table public.orders add column if not exists customer_phone text;
-- { address, place_id, lat, lng, apt, floor, building, code, dropoff, instructions }
alter table public.orders add column if not exists delivery jsonb;
alter table public.orders drop constraint if exists orders_type_check;
alter table public.orders add constraint orders_type_check check (type in ('dinein', 'takeaway', 'delivery'));

-- Same as before, and now also takes delivery orders.
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
  vname text;
  opt jsonb;
  p numeric(10, 2);
  item_name text;
begin
  select * into v from public.venues where slug = p_slug;
  if v.id is null then raise exception 'Venue not found'; end if;
  if not public.venue_active(v.id) then raise exception 'This menu is not taking orders right now'; end if;
  if not v.is_public and not public.owns_venue(v.id) then raise exception 'This menu is private right now'; end if;
  if not v.ordering_on then raise exception 'This venue is not taking orders right now'; end if;
  if p_type not in ('dinein', 'takeaway', 'delivery') then raise exception 'Invalid order type'; end if;
  if p_type = 'dinein' and not v.dinein then raise exception 'Dine-in orders are off'; end if;
  if p_type = 'takeaway' and not v.takeaway then raise exception 'Takeaway orders are off'; end if;
  if p_type = 'delivery' and not v.delivery then raise exception 'Delivery is off'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Your order is empty'; end if;

  insert into public.orders (venue_id, table_label, type, customer_name, note)
  values (v.id, left(p_table, 40), p_type, left(p_name, 60), case when v.notes then left(p_note, 300) end)
  returning id, number into o_id, o_number;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into d from public.dishes where id = (it ->> 'dish_id')::uuid and venue_id = v.id and available;
    if d.id is null then raise exception 'A dish in your order is no longer available'; end if;
    q := greatest(1, least(50, coalesce((it ->> 'qty')::int, 1)));
    -- A dish with variations is ordered as one of them, at that variation's price (or the dish price).
    vname := nullif(it ->> 'variant', '');
    if vname is not null then
      select e.value into opt from jsonb_array_elements(coalesce(d.options, '[]'::jsonb)) as e where e.value ->> 'name' = vname limit 1;
      if opt is null then raise exception 'An option in your order is no longer available'; end if;
      p := coalesce((opt ->> 'price')::numeric, d.price);
      item_name := d.name || ' (' || vname || ')';
    else
      if jsonb_array_length(coalesce(d.options, '[]'::jsonb)) > 0 then raise exception 'Choose an option for %', d.name; end if;
      p := d.price;
      item_name := d.name;
    end if;
    if p is null then raise exception '% can’t be ordered here', d.name; end if;
    insert into public.order_items (order_id, dish_id, name, price, qty) values (o_id, d.id, item_name, p, q);
    sum_total := sum_total + p * q;
  end loop;

  update public.orders set total = sum_total where id = o_id;
  return o_number;
end;
$$;

-- Places an order with the guest's phone and, for delivery, the address. Returns its number and tracking token.
create or replace function public.place_order_v3(
  p_slug text, p_table text, p_type text, p_name text, p_note text, p_items jsonb, p_phone text, p_delivery jsonb
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v public.venues;
  n bigint;
  t uuid;
  phone text := nullif(btrim(left(p_phone, 40)), '');
  addr jsonb;
begin
  select * into v from public.venues where slug = p_slug;
  if v.id is null then raise exception 'Venue not found'; end if;
  if (p_type = 'delivery' or v.ask_phone = 'required') and (phone is null or length(regexp_replace(phone, '\D', '', 'g')) < 6) then
    raise exception 'Please add your phone number';
  end if;
  if p_type = 'delivery' then
    if nullif(btrim(coalesce(p_delivery ->> 'address', '')), '') is null then raise exception 'Please add your delivery address'; end if;
    -- Only the known fields, each kept short.
    select jsonb_strip_nulls(jsonb_build_object(
      'address', left(p_delivery ->> 'address', 300), 'place_id', left(p_delivery ->> 'place_id', 300),
      'lat', case when (p_delivery ->> 'lat') ~ '^-?[0-9.]+$' then (p_delivery ->> 'lat')::numeric end,
      'lng', case when (p_delivery ->> 'lng') ~ '^-?[0-9.]+$' then (p_delivery ->> 'lng')::numeric end,
      'apt', left(nullif(p_delivery ->> 'apt', ''), 40), 'floor', left(nullif(p_delivery ->> 'floor', ''), 20),
      'building', left(nullif(p_delivery ->> 'building', ''), 80), 'code', left(nullif(p_delivery ->> 'code', ''), 40),
      'dropoff', left(nullif(p_delivery ->> 'dropoff', ''), 20), 'instructions', left(nullif(p_delivery ->> 'instructions', ''), 300)
    )) into addr;
  end if;
  n := public.place_order(p_slug, p_table, p_type, p_name, p_note, p_items);
  update public.orders set customer_phone = case when v.ask_phone <> 'off' or p_type = 'delivery' then phone end, delivery = addr
  where number = n and venue_id = v.id returning guest_token into t;
  return json_build_object('number', n, 'token', t);
end;
$$;
grant execute on function public.place_order_v3(text, text, text, text, text, jsonb, text, jsonb) to anon, authenticated;
