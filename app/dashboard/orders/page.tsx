"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { ago, money } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const COLS: [OrderStatus, string][] = [["new", "New"], ["preparing", "Preparing"], ["ready", "Ready"], ["done", "Completed"]];
const NEXT: Partial<Record<OrderStatus, [OrderStatus, string][]>> = {
  new: [["cancelled", "Decline"], ["preparing", "Accept"]],
  preparing: [["ready", "Mark ready"]],
  ready: [["done", "Complete"]],
};
const DONE_MSG: Record<OrderStatus, string> = { preparing: "accepted", ready: "is ready", done: "completed", cancelled: "declined", new: "" };

export default function Orders() {
  const { venue, setVenue, toast, orderTick, refreshNewOrders } = useDash();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<"all" | "dinein" | "takeaway">("all");
  const [, setNow] = useState(0);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    supabaseBrowser().from("orders").select("*, order_items(*)").eq("venue_id", venue.id).gte("created_at", since).order("created_at")
      .then(({ data }: { data: Order[] | null }) => setOrders(data ?? []));
  }, [venue.id, orderTick]);

  useEffect(() => { const t = setInterval(() => setNow((n) => n + 1), 60000); return () => clearInterval(t); }, []);

  async function move(o: Order, status: OrderStatus) {
    setOrders((list) => list?.map((x) => (x.id === o.id ? { ...x, status } : x)) ?? null);
    const { error } = await supabaseBrowser().from("orders").update({ status }).eq("id", o.id);
    if (error) { toast("Couldn’t update the order. Check your connection."); return; }
    toast(`Order #${o.number} ${DONE_MSG[status]}`);
    refreshNewOrders();
  }

  async function toggleAccepting() {
    const ordering_on = !venue.ordering_on;
    const { data, error } = await supabaseBrowser().from("venues").update({ ordering_on }).eq("id", venue.id).select().single();
    if (error || !data) return toast("Couldn’t change the setting.");
    setVenue(data);
    toast(ordering_on ? "Orders are on" : "Orders paused");
  }

  const list = (orders ?? []).filter((o) => filter === "all" || o.type === filter);

  return (
    <>
      <div className="orders-bar">
        <div className="seg" role="group" aria-label="Filter orders">
          {([["all", "All"], ["dinein", "Dine-in"], ["takeaway", "Takeaway"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <span className="accepting">Accepting orders <button className="switch" type="button" role="switch" aria-checked={venue.ordering_on} aria-label="Accepting orders" onClick={toggleAccepting} /></span>
      </div>
      {!venue.ordering_on && <div className="paused">Ordering is paused. Guests can still see the menu but can’t place orders.</div>}
      <div className="board">
        {COLS.map(([status, label]) => {
          let items = list.filter((o) => o.status === status);
          if (status === "done") items = items.slice(-6).reverse();
          return (
            <section className="col" key={status}>
              <div className="col-head"><b>{label}</b><span>{items.length}</span></div>
              {orders === null ? <p className="col-empty">Loading…</p> : items.length ? items.map((o) => (
                <article className="ticket" key={o.id}>
                  <div className="t-top"><b>#{o.number}</b><span>{ago(o.created_at)}</span></div>
                  <div className="t-where"><span>{o.table_label || (o.type === "takeaway" ? "Takeaway" : "Dine-in")}</span>{o.customer_name && <span>{o.customer_name}</span>}</div>
                  <ul className="t-items">{o.order_items?.map((it) => <li key={it.id}><b>{it.qty}×</b>{it.name}</li>)}</ul>
                  {o.note && <p className="t-note">{o.note}</p>}
                  <div className="t-foot"><em>{money(o.total, venue.currency)}</em>
                    <div className="t-actions">{NEXT[o.status]?.map(([to, l]) => (
                      <button key={to} type="button" className={`btn sm${to === "cancelled" ? " ghost" : ""}`} onClick={() => move(o, to)}>{l}</button>
                    ))}</div>
                  </div>
                </article>
              )) : <p className="col-empty">{status === "new" ? "New orders from guests land here." : "Nothing here yet."}</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
