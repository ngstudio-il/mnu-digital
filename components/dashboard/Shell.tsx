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
import SupportChat from "@/components/SupportChat";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: <><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></> },
  { href: "/dashboard/orders", label: "Orders", icon: <><path d="M6 3h12l1 18H5z"/><path d="M9 7a3 3 0 0 0 6 0"/></> },
  { href: "/dashboard/menu", label: "Menu", icon: <path d="M4 5h16M4 12h16M4 19h10"/> },
  { href: "/dashboard/qr", label: "QR codes", icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></> },
  { href: "/dashboard/settings", label: "Settings", icon: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></> },
];

export default function Shell({ initialVenue, support = false, subscription, user, children }: { initialVenue: Venue; support?: boolean; subscription: Subscription; user: { id: string; name: string; email: string; provider: string }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!preview) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(false); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [preview]);
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

  // Sub-pages (like Settings → Design) belong to their section.
  const current = NAV.find((n) => n.href === path) ?? NAV.find((n) => n.href !== "/dashboard" && path.startsWith(n.href + "/"));
  const title = current?.label ?? "Dashboard";

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
              <Link key={n.href} href={n.href} aria-current={current?.href === n.href ? "page" : undefined}>
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
          {support && (
            <div className="support-bar">
              <span><b>Support mode</b> · You’re viewing and editing <b>{venue.name}</b> as an admin. Changes are saved to their account.</span>
              <button type="button" className="btn sm" onClick={async () => { await fetch("/api/admin/support-mode", { method: "DELETE" }); window.location.href = `/admin/venues/${venue.id}`; }}>Exit support mode</button>
            </div>
          )}
          <header className="top">
            <h1>{title}</h1>
            <div className="top-actions">
              <span className="live-dot"><i /><span>{venue.ordering_on ? "Menu live · taking orders" : "Menu live · orders paused"}</span></span>
              <button className="top-btn" type="button" onClick={() => setPreview(true)} aria-label="Preview your menu">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg><span>Preview</span>
              </button>
              <a className="top-btn top-ext" href={`/m/${venue.slug}`} target="_blank" rel="noreferrer" aria-label="Open your menu in a new tab">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg><span>View menu</span>
              </a>
              <button className="btn ghost sm" type="button" onClick={logout}>Log out</button>
            </div>
          </header>
          <main className="view">{children}</main>
        </div>
      </div>
      {preview && (
        <div className="menu-preview" role="dialog" aria-modal="true" aria-label="Your menu">
          <div className="menu-preview-bar">
            <b>Guest view</b>
            <a className="btn ghost sm" href={`/m/${venue.slug}`} target="_blank" rel="noreferrer">Open in new tab</a>
            <button className="x" type="button" onClick={() => setPreview(false)} aria-label="Close preview">×</button>
          </div>
          <iframe src={`/m/${venue.slug}`} title={`${venue.name} menu`} />
        </div>
      )}
      {!support && <SupportChat venueId={venue.id} />}
      <div className={`toast${msg ? " show" : ""}`} role="status">{msg}</div>
    </VenueContext.Provider>
  );
}
