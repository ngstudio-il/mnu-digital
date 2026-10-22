"use client";
import { useState } from "react";
import { ChatThread } from "@/components/SupportChat";

export default function VenueActions({ venueId, slug, stripeCustomer, chatOnly = false }: { venueId: string; slug: string; stripeCustomer: string | null; chatOnly?: boolean }) {
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
      {stripeCustomer && <a className="btn ghost sm" href={`https://dashboard.stripe.com/customers/${stripeCustomer}`} target="_blank" rel="noreferrer">Open in Stripe</a>}
    </div>
  );
}
