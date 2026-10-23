"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { STATUS_LABEL, money, photoUrl } from "@/lib/format";
import type { Dish, Order } from "@/lib/types";

export default function Overview() {
  const { venue, user, orderTick, toast } = useDash();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    sb.from("orders").select("*, order_items(*)").eq("venue_id", venue.id).gte("created_at", start.toISOString()).order("created_at", { ascending: false })
      .then(({ data }: { data: Order[] | null }) => setOrders(data ?? []));
    sb.from("dishes").select("*").eq("venue_id", venue.id).then(({ data }: { data: Dish[] | null }) => setDishes(data ?? []));
  }, [venue.id, orderTick]);

  const list = orders ?? [];
  const valid = list.filter((o) => o.status !== "cancelled");
  const revenue = valid.reduce((t, o) => t + Number(o.total), 0);
  const open = list.filter((o) => ["new", "preparing", "ready"].includes(o.status));
  const sold: Record<string, number> = {};
  valid.forEach((o) => o.order_items?.forEach((it) => { sold[it.name] = (sold[it.name] ?? 0) + it.qty; }));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = top[0]?.[1] ?? 1;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const steps = [
    { done: dishes.length > 0, label: "Add your dishes", href: "/dashboard/menu" },
    { done: dishes.some((d) => d.image_path), label: "Add dish photos", href: "/dashboard/menu" },
    { done: venue.brand !== "#1f2829", label: "Pick your brand colour", href: "/dashboard/settings" },
    { done: false, label: "Print your QR codes", href: "/dashboard/qr" },
    { done: venue.ordering_on, label: "Turn on ordering", href: "/dashboard/settings" },
  ];
  const link = typeof window !== "undefined" ? `${window.location.origin}/m/${venue.slug}` : `/m/${venue.slug}`;
  const firstName = (user.name || user.email).split(/[ @]/)[0];

  function copy() {
    navigator.clipboard?.writeText(link).then(() => toast("Link copied"), () => toast("Select the link to copy it"));
  }

  return (
    <>
      <div className="hello"><h2>{greet}, {firstName}</h2><p>Here’s what’s happening at {venue.name} today.</p></div>
      <div className="kpis">
        <div className="kpi dark"><small>Orders today</small><b>{orders ? valid.length : "–"}</b></div>
        <div className="kpi"><small>Revenue today</small><b>{orders ? money(revenue, venue.currency) : "–"}</b></div>
        <div className="kpi beige"><small>Open orders</small><b>{orders ? open.length : "–"}</b></div>
        <div className="kpi sage"><small>Dishes live</small><b>{dishes.filter((d) => d.available).length} / {dishes.length}</b></div>
      </div>
      <div className="ov-grid">
        <div className="ov-col">
          <div className="card">
            <div className="card-head"><h3>Live orders</h3><Link href="/dashboard/orders">Open board →</Link></div>
            {open.length ? open.slice(0, 5).map((o) => (
              <div className="mini-order" key={o.id}>
                <span className="num">#{o.number}</span>
                <div className="what"><b>{o.type === "takeaway" ? "Pickup" : o.table_label || "Dine-in"}</b><span>{o.order_items?.map((it) => `${it.qty}× ${it.name}`).join(", ")}</span></div>
                <span className={`pill st-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                <em>{money(o.total, venue.currency)}</em>
              </div>
            )) : <p className="note">No open orders right now. New orders from guests appear here instantly.</p>}
          </div>
          <div className="card">
            <div className="card-head"><h3>Best sellers today</h3><Link href="/dashboard/menu">Edit menu →</Link></div>
            {top.length ? top.map(([name, n]) => {
              const d = dishes.find((x) => x.name === name);
              const src = photoUrl(d?.image_path);
              return (
                <div className="top-dish" key={name}>
                  {src ? <img src={src} alt="" /> : <span className="thumb-empty" />}
                  <div><b>{name}</b><div className="bar"><i style={{ width: `${Math.round((n / max) * 100)}%` }} /></div></div>
                  <span>{n} sold</span>
                </div>
              );
            }) : <p className="note">Sales will show up here once orders come in.</p>}
          </div>
        </div>
        <div className="ov-col">
          <div className="card">
            <div className="card-head"><h3>Get set up</h3><span className="progress-label">{steps.filter((s) => s.done).length} of {steps.length} done</span></div>
            <div className="checklist">
              {steps.map((s) => <Link key={s.label} className={`check${s.done ? " done" : ""}`} href={s.href}><i>{s.done ? "✓" : ""}</i><span>{s.label}</span></Link>)}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Your menu link</h3></div>
            <div className="link-box"><span>{link.replace(/^https?:\/\//, "")}</span><button className="btn sm" type="button" onClick={copy}>Copy</button></div>
            <p className="note" style={{ marginTop: 10 }}>Guests reach this page when they scan your QR code.</p>
          </div>
        </div>
      </div>
    </>
  );
}
