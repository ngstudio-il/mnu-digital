export type Venue = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  type: string;
  currency: string;
  brand: string;
  langs: string[];
  primary_lang?: string;
  is_public?: boolean;
  timezone?: string | null;
  tables: number;
  ordering_on: boolean;
  dinein: boolean;
  takeaway: boolean;
  notes: boolean;
  plan: string;
  logo_path?: string | null;
  cover_path?: string | null;
  logo_layout?: LogoLayout | null;
  theme?: string;
  font?: string | null;
  bg_color?: string | null;
  labels?: string[];
};

export type Category = { id: string; venue_id: string; name: string; position: number };

export type Dish = {
  id: string;
  venue_id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number | null;
  // Variations, e.g. coffee sizes. A null price uses the dish price.
  options?: DishOption[];
  image_path: string | null;
  image_ai?: boolean;
  available: boolean;
  tags: string[];
  position: number;
};

export type OrderStatus = "new" | "preparing" | "ready" | "done" | "cancelled";

export type OrderItem = { id: string; dish_id: string | null; name: string; price: number; qty: number };

export type Order = {
  id: string;
  number: number;
  venue_id: string;
  table_label: string | null;
  type: "dinein" | "takeaway";
  customer_name: string | null;
  note: string | null;
  status: OrderStatus;
  total: number;
  created_at: string;
  order_items?: OrderItem[];
};

export type Subscription = {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

// How the logo sits inside its frame: zoom factor, and x/y offsets in percent of the frame.
export type LogoLayout = { zoom: number; x: number; y: number };

export type DishOption = { name: string; price: number | null };
