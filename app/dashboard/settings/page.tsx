"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { BRANDS, LANGS, slugify } from "@/lib/format";
import type { Venue } from "@/lib/types";

export default function Settings() {
  const { venue, setVenue, user, toast } = useDash();
  const router = useRouter();
  const [name, setName] = useState(venue.name);
  const [type, setType] = useState(venue.type);
  const [currency, setCurrency] = useState(venue.currency);
  const [slug, setSlug] = useState(venue.slug);
  const [busy, setBusy] = useState(false);

  async function patch(p: Partial<Venue>, msg?: string) {
    const { data, error } = await supabaseBrowser().from("venues").update(p).eq("id", venue.id).select().single();
    if (error || !data) {
      toast(error?.code === "23505" ? "That menu link is taken. Try another." : "Couldn’t save. Check your connection.");
      return false;
    }
    setVenue(data);
    if (msg) toast(msg);
    return true;
  }

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Venue name can’t be empty");
    setBusy(true);
    const s = slugify(slug || name);
    setSlug(s);
    await patch({ name: name.trim(), type, currency, slug: s }, "Venue details saved");
    setBusy(false);
  }

  function toggleLang(k: string) {
    const langs = venue.langs.includes(k) ? venue.langs.filter((x) => x !== k) : [...venue.langs, k];
    if (!langs.length) return toast("Keep at least one language");
    patch({ langs });
  }

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sw = (key: "ordering_on" | "dinein" | "takeaway" | "notes", label: string, sub: string) => (
    <div className="set-row">
      <div><b>{label}</b><span>{sub}</span></div>
      <button className="switch" type="button" role="switch" aria-checked={venue[key]} aria-label={label} onClick={() => patch({ [key]: !venue[key] } as Partial<Venue>)} />
    </div>
  );

  return (
    <div className="set-grid">
      <form className="card" onSubmit={saveVenue}>
        <h3>Venue</h3>
        <label className="field" htmlFor="v-name">Venue name<input id="v-name" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="row2">
          <label className="field" htmlFor="v-type">Type<select id="v-type" value={type} onChange={(e) => setType(e.target.value)}>{["Restaurant", "Café", "Bar", "Hotel", "Other"].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field" htmlFor="v-cur">Currency<select id="v-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="$">US dollar ($)</option><option value="₪">Israeli shekel (₪)</option><option value="€">Euro (€)</option><option value="£">Pound (£)</option>
          </select></label>
        </div>
        <label className="field" htmlFor="v-slug">Menu link<input id="v-slug" value={slug} onChange={(e) => setSlug(e.target.value)} /><small>/m/{slugify(slug || name)}. Changing it breaks QR codes you already printed.</small></label>
        <div><button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
      </form>

      <div className="card">
        <h3>Ordering</h3>
        {sw("ordering_on", "Accept orders", "Guests can order from the menu")}
        {sw("dinein", "Dine-in", "Orders come in with a table number")}
        {sw("takeaway", "Takeaway", "Guests can order to pick up")}
        {sw("notes", "Order notes", "Let guests add a note to their order")}
      </div>

      <div className="card">
        <h3>Look &amp; feel</h3>
        <div><p className="fieldset-label">Brand colour</p>
          <div className="swatches">{BRANDS.map((b) => (
            <button key={b} type="button" aria-pressed={venue.brand === b} aria-label={`Brand colour ${b}`} style={{ background: b }} onClick={() => patch({ brand: b }, "Brand colour updated")} />
          ))}</div>
        </div>
        <div><p className="fieldset-label">Menu languages</p>
          <div className="chips langs">{Object.entries(LANGS).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={venue.langs.includes(k)} onClick={() => toggleLang(k)}>{l}</button>
          ))}</div>
          <p className="note" style={{ marginTop: 8 }}>Translating dish names comes in a later update.</p>
        </div>
      </div>

      <div className="card">
        <h3>Plan &amp; account</h3>
        <div className="set-row"><div><b>{venue.plan === "free" ? "Free plan" : "Pro plan"}</b><span>QR code, design styles, unlimited views</span></div><button className="btn sm" type="button" onClick={() => toast("Paid plans and billing are coming soon")}>Upgrade · $19/mo</button></div>
        <div className="set-row"><div><b>{user.name || "Your account"}</b><span>{user.email}{user.provider === "google" ? " · Google account" : ""}</span></div><button className="btn danger sm" type="button" onClick={logout}>Log out</button></div>
      </div>
    </div>
  );
}
