"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "./VenueContext";
import type { VenueInfo } from "@/lib/types";

type Key = "phone" | "address" | "hours" | "wifi" | "about";

// Settings → General: business details shown in the guest menu's header, each with a show/hide switch,
// and whether guests get a dish search box (on by default).
export default function VenueInfoCard() {
  const { venue, setVenue, toast } = useDash();
  const [v, setV] = useState<VenueInfo>(venue.info ?? {});
  const [busy, setBusy] = useState(false);
  const hidden = (k: Key) => (v.hide ?? []).includes(k);
  const toggle = (k: Key) => setV((x) => ({ ...x, hide: hidden(k) ? (x.hide ?? []).filter((h) => h !== k) : [...(x.hide ?? []), k] }));
  const set = (k: keyof VenueInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? x.trim() : x])) as VenueInfo;
    const { data, error } = await supabaseBrowser().from("venues").update({ info: clean }).eq("id", venue.id).select().single();
    setBusy(false);
    if (error || !data) return toast(/info/.test(error?.message ?? "") ? "This needs a database update first (0028_venue_info.sql)." : "Couldn’t save. Check your connection.");
    setVenue(data);
    toast("Saved. It’s on your menu now.");
  }

  const show = (k: Key, label: string) => (
    <button type="button" className="info-show" role="switch" aria-checked={!hidden(k)} onClick={() => toggle(k)} title={hidden(k) ? "Hidden on the menu" : "Shown on the menu"}>
      <span className="switch" aria-hidden="true" />{hidden(k) ? "Hidden" : "Shown"}<span className="sr-only"> · {label}</span>
    </button>
  );

  return (
    <form className="card info-card" onSubmit={save}>
      <h3>On your menu</h3>
      <p className="note" style={{ marginTop: -4 }}>Shown at the top of your menu. Leave a field empty, or switch it to Hidden, to keep it off.</p>
      <div className="info-field">
        <div className="info-label"><label htmlFor="vi-about">A few words about you</label>{show("about", "About")}</div>
        <textarea id="vi-about" value={v.about ?? ""} onChange={set("about")} maxLength={300} rows={2} placeholder="Neighbourhood bakery since 1998. Everything baked fresh every morning." dir="auto" />
      </div>
      <div className="row2">
        <div className="info-field">
          <div className="info-label"><label htmlFor="vi-phone">Phone</label>{show("phone", "Phone")}</div>
          <input id="vi-phone" type="tel" value={v.phone ?? ""} onChange={set("phone")} maxLength={40} placeholder="+1 212 555 0100" dir="ltr" />
        </div>
        <div className="info-field">
          <div className="info-label"><label htmlFor="vi-address">Address</label>{show("address", "Address")}</div>
          <input id="vi-address" value={v.address ?? ""} onChange={set("address")} maxLength={200} placeholder="12 Main St, Brooklyn, NY" dir="auto" />
        </div>
      </div>
      <div className="info-field">
        <div className="info-label"><label htmlFor="vi-hours">Opening hours</label>{show("hours", "Opening hours")}</div>
        <textarea id="vi-hours" value={v.hours ?? ""} onChange={set("hours")} maxLength={400} rows={3} placeholder={"Mon–Fri 8:00–22:00\nSat–Sun 9:00–23:00"} dir="auto" />
      </div>
      <div className="info-field">
        <div className="info-label"><span>Wi-Fi for guests</span>{show("wifi", "Wi-Fi")}</div>
        <div className="row2">
          <input aria-label="Wi-Fi network" value={v.wifi_name ?? ""} onChange={set("wifi_name")} maxLength={60} placeholder="Network name" dir="ltr" />
          <input aria-label="Wi-Fi password" value={v.wifi_password ?? ""} onChange={set("wifi_password")} maxLength={60} placeholder="Password" dir="ltr" />
        </div>
        <small className="note">Anyone with your menu link can see it.</small>
      </div>
      <div className="set-row">
        <div><b>Dish search</b><span>A search box above the categories, so guests find a dish fast.</span></div>
        <button className="switch" type="button" role="switch" aria-checked={v.search !== false} aria-label="Dish search" onClick={() => setV((x) => ({ ...x, search: x.search === false }))} />
      </div>
      <div><button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}
