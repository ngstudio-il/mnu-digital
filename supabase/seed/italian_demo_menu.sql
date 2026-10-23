-- Demo: a full Italian restaurant menu for the venue owned by nave@ngstudio.co.il.
-- Run in Supabase → SQL Editor. Safe to run once; running it again adds the dishes a second time.
-- Dishes without a photo can get AI photos from Admin → venue → "Generate missing photos".

do $$
declare
  v uuid;
  c_anti uuid; c_pizza uuid; c_pasta uuid; c_sec uuid; c_dolci uuid; c_bev uuid;
  base int;
begin
  select ve.id into v
  from public.venues ve join auth.users u on u.id = ve.owner_id
  where lower(u.email) = 'nave@ngstudio.co.il'
  order by ve.created_at limit 1;
  if v is null then raise exception 'No venue found for nave@ngstudio.co.il'; end if;

  -- Optional: start from an empty menu. Remove the two dashes at the start of the next two lines to delete the current dishes and categories first.
  -- delete from public.dishes where venue_id = v;
  -- delete from public.categories where venue_id = v;

  update public.venues set type = 'Restaurant', currency = '$',
    labels = '{Vegan,Vegetarian,Gluten-free,"Contains nuts",Dairy,Fish,Spicy,"Chef''s pick"}'
  where id = v;

  select coalesce(max(position) + 1, 0) into base from public.categories where venue_id = v;
  insert into public.categories (venue_id, name, position) values (v, 'Antipasti', base)     returning id into c_anti;
  insert into public.categories (venue_id, name, position) values (v, 'Pizze', base + 1)     returning id into c_pizza;
  insert into public.categories (venue_id, name, position) values (v, 'Pasta', base + 2)     returning id into c_pasta;
  insert into public.categories (venue_id, name, position) values (v, 'Secondi', base + 3)   returning id into c_sec;
  insert into public.categories (venue_id, name, position) values (v, 'Dolci', base + 4)     returning id into c_dolci;
  insert into public.categories (venue_id, name, position) values (v, 'Caffè & Bevande', base + 5) returning id into c_bev;

  insert into public.dishes (venue_id, category_id, name, description, price, image_path, tags, position) values
  -- Antipasti
  (v, c_anti,  'Burrata e pomodorini', 'Creamy Puglian burrata, roasted cherry tomatoes, basil oil, toasted sourdough', 17, null, '{Vegetarian,Dairy}', 0),
  (v, c_anti,  'Insalata di caprino', 'Frisée and baby greens, crumbled goat cheese, candied walnuts, aged balsamic', 15, '/assets/food/salad-sq.jpg', '{Vegetarian,"Contains nuts",Dairy}', 1),
  (v, c_anti,  'Carpaccio di manzo', 'Thinly sliced beef tenderloin, wild rocket, shaved Parmigiano, lemon and capers', 19, null, '{Gluten-free}', 2),
  (v, c_anti,  'Arancini siciliani', 'Crispy saffron risotto balls filled with ragù and mozzarella, spicy tomato sauce', 14, null, '{}', 3),
  (v, c_anti,  'Pane della casa', 'Warm house bread from our oven with whipped ricotta and tomato salsa', 9, '/assets/food/bread-sq.jpg', '{Vegetarian}', 4),
  -- Pizze
  (v, c_pizza, 'Margherita', 'San Marzano tomato, fior di latte, fresh basil, extra virgin olive oil', 18, null, '{Vegetarian,Dairy}', 0),
  (v, c_pizza, 'Diavola', 'Tomato, mozzarella, spicy salame, Calabrian chili, hot honey', 21, null, '{Spicy}', 1),
  (v, c_pizza, 'Quattro formaggi', 'Mozzarella, gorgonzola, fontina and Parmigiano, cracked black pepper', 22, null, '{Vegetarian,Dairy}', 2),
  (v, c_pizza, 'Prosciutto e rucola', 'Tomato, mozzarella, Parma ham, wild rocket, shaved Parmigiano', 24, null, '{"Chef''s pick"}', 3),
  -- Pasta
  (v, c_pasta, 'Spaghetti carbonara', 'Guanciale, egg yolk, Pecorino Romano, black pepper. No cream, the Roman way', 23, null, '{"Chef''s pick"}', 0),
  (v, c_pasta, 'Tagliatelle al ragù', 'Fresh egg pasta, slow-cooked beef and pork ragù, Parmigiano', 24, null, '{}', 1),
  (v, c_pasta, 'Penne all''arrabbiata', 'Spicy tomato sauce with garlic, chili and parsley', 18, null, '{Vegan,Spicy}', 2),
  (v, c_pasta, 'Risotto ai funghi porcini', 'Carnaroli rice, porcini and wild mushrooms, butter, Parmigiano', 26, null, '{Vegetarian,Gluten-free,Dairy}', 3),
  (v, c_pasta, 'Linguine ai frutti di mare', 'Clams, mussels, shrimp and calamari, white wine, garlic, cherry tomatoes', 31, null, '{Fish}', 4),
  -- Secondi
  (v, c_sec,   'Salmone alla griglia', 'Grilled salmon fillet, lemon, dill and olive oil, seasonal greens', 32, '/assets/food/salmon-sq.jpg', '{Fish,Gluten-free}', 0),
  (v, c_sec,   'Pollo alla milanese', 'Golden breaded chicken cutlet, rocket and cherry tomato salad, lemon', 27, null, '{}', 1),
  (v, c_sec,   'Tagliata di manzo', 'Sliced grilled sirloin, rocket, Parmigiano shavings, rosemary potatoes', 38, null, '{Gluten-free}', 2),
  (v, c_sec,   'Patatine fritte', 'Crispy fries with sea salt and garlic aioli, to share', 8, '/assets/food/fries-sq.jpg', '{Vegetarian}', 3),
  -- Dolci
  (v, c_dolci, 'Tiramisù', 'Mascarpone cream, espresso-soaked savoiardi, cocoa. Made every morning', 12, null, '{Vegetarian,"Chef''s pick"}', 0),
  (v, c_dolci, 'Panna cotta ai frutti di bosco', 'Vanilla cream with a berry compote', 11, null, '{Vegetarian,Gluten-free,Dairy}', 1),
  (v, c_dolci, 'Cannoli siciliani', 'Crisp shells filled with sweet ricotta, pistachio and chocolate chips', 11, null, '{Vegetarian,"Contains nuts"}', 2),
  -- Caffè & Bevande
  (v, c_bev,   'Espresso', 'Single origin, pulled short and strong', 4, '/assets/food/espresso-sq.jpg', '{Vegan}', 0),
  (v, c_bev,   'Cappuccino', 'Double espresso with velvety steamed milk', 5.5, null, '{Vegetarian,Dairy}', 1),
  (v, c_bev,   'Aperol Spritz', 'Aperol, prosecco, a splash of soda, orange slice', 13, null, '{Vegan}', 2),
  (v, c_bev,   'Limonata della casa', 'House lemonade with fresh mint', 6, null, '{Vegan}', 3);
end $$;
