"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import MenuLanguages from "@/components/dashboard/MenuLanguages";
import LookAndFeel from "@/components/dashboard/LookAndFeel";
import { planSummary, slugify } from "@/lib/format";
import type { Venue } from "@/lib/types";

export default function Settings() {
  const { venue, setVenue, user, toast, subscription, openBilling } = useDash();
  const plan = planSummary(subscription);
  const router = useRouter();
  const [name, setName] = useState(venue.name);
  const [type, setType] = useState(venue.type);
  const [currency, setCurrency] = useState(venue.currency);
  const [slug, setSlug] = useState(venue.slug);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ used: number; quota: number } | null>(null);
  const [imgQ, setImgQ] = useState<{ used: number; quota: number; extra: number } | null>(null);

  useEffect(() => {
    supabaseBrowser().rpc("image_quota", { p_venue: venue.id }).then(({ data }: { data: { used: number; quota: number; extra: number }[] | null }) => setImgQ(data?.[0] ?? null));
    supabaseBrowser().rpc("ai_quota", { p_venue: venue.id }).then(({ data }: { data: { used: number; quota: number }[] | null }) => setAi(data?.[0] ?? null));
  }, [venue.id, venue.plan]);

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

      <LookAndFeel />

      <MenuLanguages />

      <div className="card">
        <h3>Plan &amp; account</h3>
        <div className="set-row" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>AI text this month</b><span>{ai ? `${ai.used} of ${ai.quota}` : "–"}</span></div>
          <div className="ai-meter"><i style={{ width: ai ? `${Math.min(100, Math.round((ai.used / ai.quota) * 100))}%` : "0%" }} /></div>
          <span>Used for dish descriptions (1 credit each) and menu translations (1 credit per 10 dishes, sections or labels, per language). 100 credits a month during the free trial, 1,000 on the paid plan. Resets on the 1st.</span>
        </div>
        <div className="set-row" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>AI images this month</b><span>{imgQ ? `${imgQ.used} of ${imgQ.quota}${imgQ.extra ? ` · ${imgQ.extra} from packs` : ""}` : "–"}</span></div>
          <div className="ai-meter"><i style={{ width: imgQ && imgQ.quota ? `${Math.min(100, Math.round((imgQ.used / imgQ.quota) * 100))}%` : "0%" }} /></div>
          <span>10 a month during the trial, 30 on the paid plan. Extra packs from the dish editor never expire.</span>
        </div>
        <div className="set-row"><div><b>{plan.title}</b><span>{plan.detail}</span></div><button className="btn sm" type="button" onClick={openBilling}>{subscription.status === "past_due" ? "Update card" : "Manage billing"}</button></div>
        <div className="set-row"><div><b>{user.name || "Your account"}</b><span>{user.email}{user.provider === "google" ? " · Google account" : ""}</span></div><button className="btn danger sm" type="button" onClick={logout}>Log out</button></div>
      </div>
    </div>
  );
}
