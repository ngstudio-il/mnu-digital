import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";

export type VenueRow = {
  id: string; name: string; slug: string; type: string; created_at: string; ordering_on: boolean;
  owner_id: string; owner_email: string; owner_name: string; provider: string; last_sign_in: string | null;
  status: string; trial_end: string | null; current_period_end: string | null; stripe_customer_id: string | null;
  dishes: number; orders30: number; revenue30: number; ordersToday: number; lastOrder: string | null;
  aiUsed: number; imports: number; images: number; unread: number;
};

const month = () => new Date().toISOString().slice(0, 7);

// One pass over the tables the admin needs. Fine for thousands of venues; move to SQL views when it grows.
export async function loadAdminData() {
  if (!(await getAdmin())) throw new Error("Not an admin");
  const db = supabaseAdmin();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [venues, subs, dishes, orders, usage, unread, users] = await Promise.all([
    db.from("venues").select("id, name, slug, type, created_at, ordering_on, owner_id").order("created_at", { ascending: false }),
    db.from("subscriptions").select("venue_id, status, trial_end, current_period_end, stripe_customer_id"),
    db.from("dishes").select("venue_id"),
    db.from("orders").select("venue_id, total, status, created_at").gte("created_at", since30),
    db.from("ai_usage").select("venue_id, used, imports, images").eq("month", month()),
    db.from("support_messages").select("venue_id").eq("sender", "owner").eq("read_by_admin", false),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const userList = users.data?.users ?? [];
  const byUser = new Map(userList.map((u) => [u.id, u]));
  const subBy = new Map((subs.data ?? []).map((s) => [s.venue_id, s]));
  const usageBy = new Map((usage.data ?? []).map((u) => [u.venue_id, u]));
  const tally = (rows: { venue_id: string }[] | null) => { const m = new Map<string, number>(); (rows ?? []).forEach((r) => m.set(r.venue_id, (m.get(r.venue_id) ?? 0) + 1)); return m; };
  const dishCount = tally(dishes.data);
  const unreadBy = tally(unread.data);

  const ordersBy = new Map<string, { n: number; rev: number; today: number; last: string | null }>();
  for (const o of orders.data ?? []) {
    const e = ordersBy.get(o.venue_id) ?? { n: 0, rev: 0, today: 0, last: null };
    if (o.status !== "cancelled") { e.n++; e.rev += Number(o.total) || 0; if (new Date(o.created_at) >= today) e.today++; }
    if (!e.last || o.created_at > e.last) e.last = o.created_at;
    ordersBy.set(o.venue_id, e);
  }

  const rows: VenueRow[] = (venues.data ?? []).map((v) => {
    const u = byUser.get(v.owner_id);
    const s = subBy.get(v.id);
    const o = ordersBy.get(v.id);
    const a = usageBy.get(v.id);
    const meta = (u?.user_metadata ?? {}) as Record<string, string>;
    return {
      ...v,
      owner_email: u?.email ?? "—", owner_name: meta.full_name ?? meta.name ?? "", provider: (u?.app_metadata?.provider as string) ?? "email",
      last_sign_in: u?.last_sign_in_at ?? null,
      status: s?.status ?? "none", trial_end: s?.trial_end ?? null, current_period_end: s?.current_period_end ?? null, stripe_customer_id: s?.stripe_customer_id ?? null,
      dishes: dishCount.get(v.id) ?? 0, orders30: o?.n ?? 0, revenue30: o?.rev ?? 0, ordersToday: o?.today ?? 0, lastOrder: o?.last ?? null,
      aiUsed: a?.used ?? 0, imports: a?.imports ?? 0, images: (a as { images?: number } | undefined)?.images ?? 0, unread: unreadBy.get(v.id) ?? 0,
    };
  });

  const owners = new Set(rows.map((r) => r.owner_id));
  const { data: adminRows } = await db.from("admins").select("email");
  const admins = new Set((adminRows ?? []).map((r) => String(r.email).toLowerCase()));
  const noVenue = userList.filter((u) => !owners.has(u.id)).map((u) => ({ id: u.id, email: u.email ?? "—", created_at: u.created_at, provider: (u.app_metadata?.provider as string) ?? "email", admin: admins.has((u.email ?? "").toLowerCase()) }));
  return { rows, noVenue, totalUsers: userList.length };
}

export const PRICE = 39;
