-- Public or private menu. A private menu is only shown to its owner (and admins), and takes no guest orders.
-- Run once in Supabase → SQL Editor after 0012_logo_layout.sql. Safe to run again.

alter table public.venues add column if not exists is_public boolean not null default true;

-- Same as before, plus: private menus don't take orders.
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
    insert into public.order_items (order_id, dish_id, name, price, qty) values (o_id, d.id, d.name, d.price, q);
    sum_total := sum_total + d.price * q;
  end loop;

  update public.orders set total = sum_total where id = o_id;
  return o_number;
end;
$$;
