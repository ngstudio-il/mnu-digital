"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import type { Venue } from "@/lib/types";

const TYPES = ["Restaurant", "Café", "Bar", "Hotel", "Other"];

// First visit after paying: the owner names the business. Until then the venue has a placeholder name.
export default function SetupVenue({ venue, onDone }: { venue: Venue; onDone: (v: Venue) => void }) {
  const [name, setName] = useState(venue.name === "My venue" ? "" : venue.name);
  const [type, setType] = useState(venue.type || "Restaurant");
  const [currency, setCurrency] = useState(venue.currency || "$");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Enter your business name.");
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    let slug = slugify(name);
    for (let i = 0; i < 4; i++) {
      const { data, error } = await sb.from("venues").update({ name: name.trim(), type, currency, slug, setup_done: true }).eq("id", venue.id).select().single();
      if (data) { setBusy(false); return onDone(data); }
      if (error?.code === "23505") { slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`; continue; }
      setBusy(false);
      return setErr(error?.message ?? "Couldn’t save. Try again.");
    }
    setBusy(false);
    setErr("Couldn’t create a link for this name. Try a slightly different one.");
  }

  return (
    <div className="overlay setup-overlay">
      <form className="modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title" onSubmit={save} noValidate>
        <span className="setup-badge">✓ You’re all set</span>
        <h3 id="setup-title">What’s your business called?</h3>
        <p className="note">This is the name guests see at the top of your menu. You can change it any time in Settings.</p>
        <label className="field" htmlFor="sv-name">Business name<input id="sv-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Olive & Salt" autoComplete="organization" /></label>
        <div className="row2">
          <label className="field" htmlFor="sv-type">Type<select id="sv-type" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field" htmlFor="sv-cur">Currency<select id="sv-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="$">US dollar ($)</option><option value="₪">Israeli shekel (₪)</option><option value="€">Euro (€)</option><option value="£">Pound (£)</option>
          </select></label>
        </div>
        <p className="note">Your menu link: <b translate="no">mnu.digital/m/{slugify(name || "your-business")}</b></p>
        {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
        <button className="btn block" type="submit" disabled={busy}>{busy ? "Saving…" : "Continue to my menu"}</button>
      </form>
    </div>
  );
}
