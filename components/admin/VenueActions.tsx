"use client";
import { useState } from "react";
import { ChatThread } from "@/components/SupportChat";

export default function VenueActions({ venueId, slug, stripeCustomer, chatOnly = false }: { venueId: string; slug: string; stripeCustomer: string | null; chatOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  if (chatOnly) return <div className="adm-chatbox"><ChatThread venueId={venueId} as="admin" /></div>;

  const [gen, setGen] = useState<{ running: boolean; made: number; remaining: number | null; msg: string }>({ running: false, made: 0, remaining: null, msg: "" });
  async function generatePhotos() {
    setGen({ running: true, made: 0, remaining: null, msg: "" });
    let made = 0;
    for (let round = 0; round < 40; round++) {
      const res = await fetch("/api/admin/generate-images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venueId }) }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) { setGen({ running: false, made, remaining: null, msg: json.error ?? "Stopped: request failed." }); return; }
      made += json.done;
      setGen({ running: true, made, remaining: json.remaining, msg: json.errors?.length ? json.errors[0] : "" });
      if (json.remaining === 0) break;
      if (json.done === 0) { setGen({ running: false, made, remaining: json.remaining, msg: json.errors?.[0] ?? "Stopped: no image could be created." }); return; }
    }
    setGen((g) => ({ ...g, running: false }));
  }

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
      <button className="btn ghost sm" type="button" onClick={generatePhotos} disabled={gen.running}>{gen.running ? `Creating photos… ${gen.made} done${gen.remaining !== null ? `, ${gen.remaining} left` : ""}` : "Generate missing photos"}</button>
      {(gen.msg || (!gen.running && gen.made > 0)) && <p className="note" style={{ width: "100%" }}>{gen.made > 0 && !gen.running ? `${gen.made} photos created. ` : ""}{gen.msg}</p>}
      {stripeCustomer && <a className="btn ghost sm" href={`https://dashboard.stripe.com/customers/${stripeCustomer}`} target="_blank" rel="noreferrer">Open in Stripe</a>}
    </div>
  );
}
