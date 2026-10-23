"use client";
import { useEffect, useMemo, useState } from "react";
import { allZones, browserZone, zoneLabel } from "@/lib/timezone";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
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
  const [tz, setTz] = useState(venue.timezone || browserZone());
  const zones = useMemo(() => { const z = allZones(); return z.includes(tz) ? z : [tz, ...z]; }, [tz]);
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
      toast(error?.code === "23505" ? "That menu link is taken. Try another." : error?.message.includes("timezone") ? "Time zone needs a database update first (0014_venue_timezone.sql)." : "Couldn’t save. Check your connection.");
      return false;
    }
    setVenue(data);
    if (msg) toast(msg);
    return true;
  }

  async function patchVisibility(pub: boolean) {
    const { data, error } = await supabaseBrowser().from("venues").update({ is_public: pub }).eq("id", venue.id).select().single();
    if (error || !data) return toast(error?.message.includes("is_public") ? "Visibility needs a database update first (0013_menu_visibility.sql)." : "Couldn’t save. Check your connection.");
    setVenue(data);
    toast(pub ? "Your menu is public" : "Your menu is private. Only you can see it.");
  }

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Venue name can’t be empty");
    setBusy(true);
    const s = slugify(slug || name);
    setSlug(s);
    await patch({ name: name.trim(), type, currency, slug: s, ...("timezone" in venue ? { timezone: tz } : {}) }, "Venue details saved");
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
        <label className="field" htmlFor="v-tz">Time zone
          <select id="v-tz" value={tz} onChange={(e) => setTz(e.target.value)} translate="no">{zones.map((z) => <option key={z} value={z}>{zoneLabel(z)}</option>)}</select>
          <small>Used for today’s orders and revenue on your dashboard.</small>
        </label>
        <label className="field" htmlFor="v-slug">Menu link<input id="v-slug" value={slug} onChange={(e) => setSlug(e.target.value)} /><small>/m/{slugify(slug || name)}. Changing it breaks QR codes you already printed.</small></label>
        <div><button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
      </form>

      <div className="card">
        <h3>Menu visibility</h3>
        <div className="vis-opts" role="radiogroup" aria-label="Menu visibility">
          {([
            [true, "Public", "Anyone with your QR code or link can see the menu and order."],
            [false, "Private", "Only you can see the menu. Guests see a “private” notice and can’t order. Good while you’re still setting up."],
          ] as const).map(([pub, label, sub]) => (
            <button key={label} type="button" role="radio" aria-checked={(venue.is_public !== false) === pub} className="vis-opt"
              onClick={() => { if ((venue.is_public !== false) !== pub) patchVisibility(pub); }}>
              <span className="vis-icon" aria-hidden="true">{pub
                ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
                : <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}</span>
              <span><b>{label}</b><small>{sub}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Ordering</h3>
        {sw("ordering_on", "Accept orders", "Guests can order from the menu")}
        {sw("dinein", "Dine-in", "Orders come in with a table number")}
        {sw("takeaway", "Takeaway", "Guests can order to take away")}
        {sw("notes", "Order notes", "Let guests add a note to their order")}
      </div>

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
