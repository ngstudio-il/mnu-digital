import Link from "next/link";
import { loadAdminData, PRICE } from "@/lib/admin-data";
import { ago } from "@/lib/format";

export default async function AdminOverview() {
  const { rows, noVenue, totalUsers } = await loadAdminData();
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const paying = count("active") + count("past_due");
  const week = Date.now() - 7 * 86400000;
  const signups7 = rows.filter((r) => new Date(r.created_at).getTime() > week).length + noVenue.filter((u) => new Date(u.created_at).getTime() > week).length;
  const orders30 = rows.reduce((t, r) => t + r.orders30, 0);
  const gmv30 = rows.reduce((t, r) => t + r.revenue30, 0);
  const ordersToday = rows.reduce((t, r) => t + r.ordersToday, 0);
  const ai = rows.reduce((t, r) => t + r.aiUsed, 0);
  const imports = rows.reduce((t, r) => t + r.imports, 0);
  const unread = rows.reduce((t, r) => t + r.unread, 0);
  const endingSoon = rows.filter((r) => r.status === "trialing" && r.trial_end && new Date(r.trial_end).getTime() - Date.now() < 2 * 86400000);
  const top = [...rows].sort((a, b) => b.orders30 - a.orders30).filter((r) => r.orders30 > 0).slice(0, 6);
  const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

  return (
    <>
      <div className="kpis">
        <div className="kpi dark"><small>Monthly recurring revenue</small><b>{usd(paying * PRICE)}</b></div>
        <div className="kpi"><small>Paying venues</small><b>{paying}</b></div>
        <div className="kpi sage"><small>In free trial</small><b>{count("trialing")}</b></div>
        <div className="kpi beige"><small>Sign-ups, last 7 days</small><b>{signups7}</b></div>
      </div>
      <div className="kpis">
        <div className="kpi"><small>Accounts (all users)</small><b>{totalUsers}</b></div>
        <div className="kpi"><small>Guest orders, last 30 days</small><b>{orders30}</b></div>
        <div className="kpi"><small>Order value, last 30 days</small><b>{usd(gmv30)}</b></div>
        <div className="kpi"><small>AI descriptions / imports this month</small><b>{ai} / {imports}</b></div>
      </div>

      <div className="ov-grid">
        <div className="ov-col">
          <div className="card">
            <div className="card-head"><h3>Newest venues</h3><Link href="/admin/venues">All venues →</Link></div>
            {rows.slice(0, 6).map((r) => (
              <Link key={r.id} href={`/admin/venues/${r.id}`} className="mini-order" style={{ textDecoration: "none", gridTemplateColumns: "1fr auto auto" }}>
                <div className="what"><b>{r.name}</b><span>{r.owner_email} · {ago(r.created_at)}</span></div>
                <span className={`pill st-${r.status}`}>{r.status === "none" ? "No card" : r.status.replace("_", " ")}</span>
                <em>{r.dishes} dishes</em>
              </Link>
            ))}
            {!rows.length && <p className="note">No venues yet.</p>}
          </div>
          <div className="card">
            <div className="card-head"><h3>Most active, last 30 days</h3></div>
            {top.length ? top.map((r) => (
              <Link key={r.id} href={`/admin/venues/${r.id}`} className="mini-order" style={{ textDecoration: "none", gridTemplateColumns: "1fr auto auto" }}>
                <div className="what"><b>{r.name}</b><span>{r.orders30} orders</span></div><span />
                <em>{usd(r.revenue30)}</em>
              </Link>
            )) : <p className="note">No guest orders in the last 30 days.</p>}
          </div>
        </div>
        <div className="ov-col">
          <div className="card">
            <div className="card-head"><h3>Needs attention</h3></div>
            <div className="checklist">
              <Link className="check" href="/admin/support"><i>{unread}</i><span>Unread support messages</span></Link>
              <Link className="check" href="/admin/venues?status=past_due"><i>{count("past_due")}</i><span>Failed payments</span></Link>
              <Link className="check" href="/admin/venues?status=trialing"><i>{endingSoon.length}</i><span>Trials ending in 2 days</span></Link>
              <Link className="check" href="/admin/venues?status=none"><i>{count("none") + noVenue.length}</i><span>Signed up but never started a trial</span></Link>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>At a glance</h3></div>
            <div className="adm-facts">
              <div><small>Orders today</small><b>{ordersToday}</b></div>
              <div><small>Cancelled</small><b>{count("canceled")}</b></div>
              <div><small>Venues total</small><b>{rows.length}</b></div>
              <div><small>Dishes on menus</small><b>{rows.reduce((t, r) => t + r.dishes, 0)}</b></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
