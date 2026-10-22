"use client";
import "@/styles/app.css";
import "@/styles/dashboard.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Subscription, Venue } from "@/lib/types";
import { planSummary } from "@/lib/format";
import { VenueContext } from "./VenueContext";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: <><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></> },
  { href: "/dashboard/orders", label: "Orders", icon: <><path d="M6 3h12l1 18H5z"/><path d="M9 7a3 3 0 0 0 6 0"/></> },
  { href: "/dashboard/menu", label: "Menu", icon: <path d="M4 5h16M4 12h16M4 19h10"/> },
  { href: "/dashboard/qr", label: "QR codes", icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></> },
  { href: "/dashboard/settings", label: "Settings", icon: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></> },
];

export default function Shell({ initialVenue, subscription, user, children }: { initialVenue: Venue; subscription: Subscription; user: { id: string; name: string; email: string; provider: string }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [venue, setVenue] = useState(initialVenue);
  const [newOrders, setNewOrders] = useState(0);
  const [orderTick, setOrderTick] = useState(0);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2600);
  }, []);

  const refreshNewOrders = useCallback(async () => {
    const { count } = await supabaseBrowser().from("orders").select("id", { count: "exact", head: true }).eq("venue_id", venue.id).eq("status", "new");
    setNewOrders(count ?? 0);
  }, [venue.id]);

  // Live orders: any insert or update for this venue refreshes the badge and open order views.
  useEffect(() => {
    refreshNewOrders();
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`orders-${venue.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `venue_id=eq.${venue.id}` }, (payload: { eventType: string; new: { number?: number; table_label?: string } }) => {
        refreshNewOrders();
        setOrderTick((t) => t + 1);
        if (payload.eventType === "INSERT") toast(`New order #${payload.new.number ?? ""}${payload.new.table_label ? " · " + payload.new.table_label : ""}`);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [venue.id, refreshNewOrders, toast]);

  const plan = planSummary(subscription);
  async function openBilling() {
    const res = await fetch("/api/stripe/portal", { method: "POST" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && json.url) window.location.href = json.url;
    else toast(json.error ?? "Couldn’t open billing. Try again.");
  }

  const title = NAV.find((n) => n.href === path)?.label ?? "Dashboard";

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <VenueContext.Provider value={{ venue, setVenue, user, toast, newOrders, refreshNewOrders, orderTick, subscription, openBilling }}>
      <div className="shell">
        <aside className="side">
          <a className="logo" href="/"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
          <nav className="nav" aria-label="Dashboard">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
                <svg viewBox="0 0 24 24">{n.icon}</svg>{n.label}
                {n.label === "Orders" && newOrders > 0 && <span className="badge">{newOrders}</span>}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            {(() => {
              const daysLeft = subscription.trial_end ? Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / 86400000) : 99;
              const urgent = subscription.status === "past_due" || (subscription.status === "trialing" && daysLeft <= 2);
              if (urgent) return <div className="plan-card"><b>{plan.title}</b><p>{plan.detail}</p><button className="btn sm" type="button" onClick={openBilling}>{subscription.status === "past_due" ? "Update card" : "Manage billing"}</button></div>;
              return null;
            })()}
            <div className="me"><span className="avatar">{(user.name || user.email || "U").charAt(0).toUpperCase()}</span><div><b>{user.name || user.email}</b><span>{venue.name}</span></div></div>
          </div>
        </aside>
        <div className="main">
          <header className="top">
            <h1>{title}</h1>
            <div className="top-actions">
              <span className="live-dot"><i /><span>{venue.ordering_on ? "Menu live · taking orders" : "Menu live · orders paused"}</span></span>
              <a className="btn ghost sm" href={`/m/${venue.slug}`} target="_blank" rel="noreferrer">View menu</a>
              <button className="btn ghost sm" type="button" onClick={logout}>Log out</button>
            </div>
          </header>
          <main className="view">{children}</main>
        </div>
      </div>
      <div className={`toast${msg ? " show" : ""}`} role="status">{msg}</div>
    </VenueContext.Provider>
  );
}
