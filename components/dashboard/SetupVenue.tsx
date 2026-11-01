"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import type { Venue } from "@/lib/types";

import { VENUE_TYPES as TYPES } from "@/lib/venue-types";
import { currencyForCountry, guessCountry } from "@/lib/countries";

// Letters, numbers and single dashes, no dash at either end.
const cleanSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

// First visit after paying: the owner names the business. Until then the venue has a placeholder name.
export default function SetupVenue({ venue, onDone }: { venue: Venue; onDone: (v: Venue) => void }) {
  const [name, setName] = useState(venue.name === "My venue" ? "" : venue.name);
  const [type, setType] = useState(venue.type || "Restaurant");
  const [currency, setCurrency] = useState(venue.currency || "$");
  // Currency from where the owner is ($ by default; a menu imported on the try-it page keeps its own).
  useEffect(() => { if (!venue.currency || venue.currency === "$") setCurrency(currencyForCountry(guessCountry())); }, [venue.currency]);
  const [err, setErr] = useState("");
  // The menu link follows the name until the owner edits it; we check it's free as they type.
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState(false);
  const slugNow = customSlug !== null ? cleanSlug(customSlug) : slugify(name || "your-business");
  const [slugState, setSlugState] = useState<"checking" | "free" | "taken" | "short">("checking");
  useEffect(() => {
    if (slugNow.length < 3) { setSlugState("short"); return; }
    setSlugState("checking");
    const t = setTimeout(async () => {
      const { data } = await supabaseBrowser().from("venues").select("id").eq("slug", slugNow).neq("id", venue.id).limit(1);
      setSlugState(data?.length ? "taken" : "free");
    }, 350);
    return () => clearTimeout(t);
  }, [slugNow, venue.id]);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Enter your business name.");
    if (customSlug !== null && slugState === "short") return setErr("Make the menu link at least 3 characters.");
    if (customSlug !== null && slugState === "taken") return setErr("That menu link is taken. Try another one.");
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    let slug = customSlug !== null ? cleanSlug(customSlug) : slugify(name);
    for (let i = 0; i < 4; i++) {
      const { data, error } = await sb.from("venues").update({ name: name.trim(), type, currency, slug, setup_done: true }).eq("id", venue.id).select().single();
      if (data) { setBusy(false); return onDone(data); }
      if (error?.code === "23505") {
        // A link the owner chose is theirs to change; one made from the name just gets a short suffix.
        if (customSlug !== null) { setBusy(false); setSlugState("taken"); return setErr("That menu link was just taken. Try another one."); }
        slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`; continue;
      }
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
        {editingSlug ? (
          <label className="field" htmlFor="sv-slug">Menu link
            <span className="slug-input" translate="no"><i>mnu.digital/m/</i><input id="sv-slug" autoFocus value={customSlug ?? slugNow} onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 48))} onBlur={() => customSlug !== null && setCustomSlug(cleanSlug(customSlug))} spellCheck={false} autoComplete="off" /></span>
            <small className={`slug-state ${slugState}`}>{slugState === "free" ? "✓ Available" : slugState === "taken" ? "✕ Taken. Try another one." : slugState === "short" ? "At least 3 characters: letters, numbers and dashes." : "Checking…"}</small>
          </label>
        ) : (
          <p className="note slug-line">Your menu link: <button type="button" className="slug-edit" onClick={() => { setCustomSlug(slugNow); setEditingSlug(true); }} title="Edit link"><b translate="no">mnu.digital/m/{slugNow}</b><span aria-hidden="true">✎</span><span className="sr-only">Edit menu link</span></button>
            {slugState === "taken" && <span className="slug-state taken"> Taken, we’ll add a few letters, or tap to choose your own.</span>}
          </p>
        )}
        {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
        <button className="btn block" type="submit" disabled={busy}>{busy ? "Saving…" : "Continue to my menu"}</button>
      </form>
    </div>
  );
}
