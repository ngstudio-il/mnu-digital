import { notFound } from "next/navigation";
import { loadAdminData } from "@/lib/admin-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUS_LABEL, ago, money } from "@/lib/format";
import VenueActions from "@/components/admin/VenueActions";
import type { OrderStatus } from "@/lib/types";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function AdminVenue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await loadAdminData();
  const v = rows.find((r) => r.id === id);
  if (!v) notFound();
  const db = supabaseAdmin();
  const [{ data: venue }, { data: orders }, { count: cats }] = await Promise.all([
    db.from("venues").select("currency, brand, langs, tables, dinein, takeaway").eq("id", id).single(),
    db.from("orders").select("number, table_label, type, total, status, created_at").eq("venue_id", id).order("created_at", { ascending: false }).limit(8),
    db.from("categories").select("id", { count: "exact", head: true }).eq("venue_id", id),
  ]);
  const cur = venue?.currency ?? "$";

  return (
    <div className="adm-grid">
      <div className="ov-col">
        <div className="card">
          <div className="card-head"><h3 style={{ fontSize: 22 }}>{v.name}</h3><span className={`pill st-${v.status}`}>{v.status.replace("_", " ")}</span></div>
          <p className="note" style={{ marginBottom: 16 }}>{v.type} · /m/{v.slug} · joined {day(v.created_at)}</p>
          <VenueActions venueId={v.id} slug={v.slug} stripeCustomer={v.stripe_customer_id} />
        </div>
        <div className="card">
          <div className="card-head"><h3>Activity</h3></div>
          <div className="adm-facts">
            <div><small>Dishes</small><b>{v.dishes}</b></div>
            <div><small>Categories</small><b>{cats ?? 0}</b></div>
            <div><small>Orders, 30 days</small><b>{v.orders30}</b></div>
            <div><small>Order value, 30 days</small><b>{money(v.revenue30, cur)}</b></div>
            <div><small>AI text credits this month</small><b>{v.aiUsed}</b></div>
            <div><small>Menu imports this month</small><b>{v.imports}</b></div>
            <div><small>Ordering</small><b>{v.ordering_on ? "On" : "Paused"}</b></div>
            <div><small>Tables</small><b>{venue?.tables ?? "—"}</b></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Recent orders</h3></div>
          {orders?.length ? orders.map((o) => (
            <div className="mini-order" key={o.number}>
              <span className="num">#{o.number}</span>
              <div className="what"><b>{o.table_label || (o.type === "takeaway" ? "Takeaway" : "Dine-in")}</b><span>{ago(o.created_at)}</span></div>
              <span className={`pill st-${o.status}`}>{STATUS_LABEL[o.status as OrderStatus]}</span>
              <em>{money(o.total, cur)}</em>
            </div>
          )) : <p className="note">No orders yet.</p>}
        </div>
      </div>
      <div className="ov-col">
        <div className="card">
          <div className="card-head"><h3>Owner</h3></div>
          <div className="adm-facts">
            <div style={{ gridColumn: "1 / -1" }}><small>Email</small><b style={{ fontSize: 15 }}>{v.owner_email}</b></div>
            <div><small>Name</small><b style={{ fontSize: 15 }}>{v.owner_name || "—"}</b></div>
            <div><small>Signs in with</small><b style={{ fontSize: 15 }}>{v.provider}</b></div>
            <div><small>Last sign-in</small><b style={{ fontSize: 15 }}>{v.last_sign_in ? ago(v.last_sign_in) : "—"}</b></div>
            <div><small>{v.status === "trialing" ? "Trial ends" : "Renews"}</small><b style={{ fontSize: 15 }}>{day(v.status === "trialing" ? v.trial_end : v.current_period_end)}</b></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Support chat</h3></div>
          <VenueActions venueId={v.id} slug={v.slug} stripeCustomer={null} chatOnly />
        </div>
      </div>
    </div>
  );
}
