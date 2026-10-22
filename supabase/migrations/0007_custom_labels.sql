-- Each venue manages its own dish labels (Vegan, Spicy, Chef's pick…).
-- Run once in Supabase → SQL Editor after 0006_guest_order_tracking.sql.
alter table public.venues add column if not exists labels text[] not null
  default '{Vegan,Vegetarian,Gluten-free,"Contains nuts",Dairy,Fish,Spicy}';
