"use client";
import { useState } from "react";
import { ChatThread } from "@/components/SupportChat";

export default function VenueActions({ venueId, slug, paypalSubscription, chatOnly = false }: { venueId: string; slug: string; paypalSubscription: string | null; chatOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  if (chatOnly) return <div className="adm-chatbox"><ChatThread venueId={venueId} as="admin" /></div>;

  async function openDashboard() {
    setBusy(true);
    const res = await fetch("/api/admin/support-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venueId }) });
    if (res.ok) window.location.href = "/dashboard";
    else setBusy(false);
  }

  return (
    <div className="adm-actions">
      <button className="btn sm" type="button" onClick={openDashboard} disabled={busy}>{busy ? "Opening…" : "Open their dashboard"}</button>
      <a className="btn ghost sm" href={`/m/${slug}`} target="_blank" rel="noreferrer">View public menu</a>
      {paypalSubscription && <a className="btn ghost sm" href={`https://www.paypal.com/billing/subscriptions/${encodeURIComponent(paypalSubscription)}`} target="_blank" rel="noreferrer">Open in PayPal</a>}
    </div>
  );
}
