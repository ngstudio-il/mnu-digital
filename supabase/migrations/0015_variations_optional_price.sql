-- Dishes without a price (a catalogue-style menu) and dish variations (e.g. coffee: short, long).
-- Run once in Supabase → SQL Editor after 0014_venue_timezone.sql. Safe to run again.

alter table public.dishes alter column price drop not null;
alter table public.dishes alter column price drop default;
-- Variations: [{ "name": "Long", "price": 14 }, { "name": "Short", "price": null }]. A null price uses the dish price.
alter table public.dishes add column if not exists options jsonb not null default '[]'::jsonb;

-- Same as before, plus variations and dishes without a price.
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
