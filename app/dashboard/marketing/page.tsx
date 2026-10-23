"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { syncTranslations } from "@/lib/translate-client";
import { ID_RULES } from "@/lib/marketing";
import type { Marketing } from "@/lib/types";
import { photoUrl } from "@/lib/format";
import { shrink } from "@/lib/shrink";

type Popup = NonNullable<Marketing["popup"]>;
const EMPTY_POPUP: Popup = { enabled: false, title: "", body: "", cta_label: "", cta_url: "", delay: 3, frequency: "once", version: 1 };

export default function MarketingPage() {
  const { venue, setVenue, toast } = useDash();
  const m = venue.marketing ?? {};
  const [meta, setMeta] = useState(m.meta_pixel ?? "");
  const [google, setGoogle] = useState((m.google_tags ?? []).join(", "));
  const [tiktok, setTiktok] = useState(m.tiktok_pixel ?? "");
  const [popup, setPopup] = useState<Popup>({ ...EMPTY_POPUP, ...(m.popup ?? {}) });
  const [busy, setBusy] = useState<"" | "tags" | "popup">("");
  const set = (p: Partial<Popup>) => setPopup((x) => ({ ...x, ...p }));
  const [uploading, setUploading] = useState(false);

  async function uploadImage(raw: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(raw.type)) return toast("Use a PNG, JPG or WebP image.");
    const file = await shrink(raw, 1400);
    if (file.size > 5 * 1024 * 1024) return toast("That image is too large. Try one under 5 MB.");
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${venue.id}/popup-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("dish-photos").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setUploading(false);
    if (error) return toast("Upload failed: " + error.message);
    set({ image_path: path });
    toast("Image added. Save the popup to publish it.");
  }

  async function save(next: Marketing, kind: "tags" | "popup", msg: string) {
    setBusy(kind);
    const { data, error } = await supabaseBrowser().from("venues").update({ marketing: next }).eq("id", venue.id).select().single();
    setBusy("");
    if (error || !data) return toast(error?.message.includes("marketing") ? "Marketing needs a database update first (0017_marketing.sql)." : "Couldn’t save. Check your connection.");
    setVenue(data);
    toast(msg);
    if (kind === "popup" && venue.langs.length > 1) syncTranslations();
  }

  function saveTags(e: React.FormEvent) {
    e.preventDefault();
    const tags = google.split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
    const bad = [
      meta.trim() && !ID_RULES.meta.test(meta.trim()) && "Meta Pixel ID should be numbers only, e.g. 1234567890123456.",
      tags.find((t) => !ID_RULES.google.test(t)) && `“${tags.find((t) => !ID_RULES.google.test(t))}” isn’t a Google tag ID. Use G-…, AW-… or GTM-….`,
      tiktok.trim() && !ID_RULES.tiktok.test(tiktok.trim().toUpperCase()) && "TikTok Pixel ID should look like C4ABCD1234EFGH5678.",
    ].find(Boolean);
    if (bad) return toast(bad as string);
    save({ ...m, meta_pixel: meta.trim() || undefined, google_tags: tags, tiktok_pixel: tiktok.trim().toUpperCase() || undefined }, "tags", "Tracking saved. It’s live on your menu.");
  }

  function savePopup(e: React.FormEvent) {
    e.preventDefault();
    if (popup.enabled && !popup.title.trim() && !popup.body.trim() && !popup.image_path) return toast("Add an image, a title or a message for the popup.");
    if (popup.cta_label?.trim() && !/^https?:\/\/\S+$/i.test(popup.cta_url?.trim() ?? "")) return toast("The button link should start with https://");
    const changed = popup.title !== m.popup?.title || popup.body !== m.popup?.body || popup.cta_label !== m.popup?.cta_label || popup.image_path !== m.popup?.image_path;
    // A new message counts as unseen again for guests who closed the old one.
    save({ ...m, popup: { ...popup, title: popup.title.trim(), body: popup.body.trim(), cta_label: popup.cta_label?.trim(), cta_url: popup.cta_url?.trim(), version: (m.popup?.version ?? 0) + (changed ? 1 : 0) } }, "popup", popup.enabled ? "Popup saved. Guests will see it." : "Popup saved (off).");
  }

  return (
    <div className="mk-grid">
      <form className="card" onSubmit={saveTags}>
        <div className="mk-head">
          <span className="mk-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" /></svg></span>
          <div><h3>Tracking &amp; ads</h3><p className="note">Add your pixel and tag IDs and we place them in the &lt;head&gt; of your menu page. Use them to measure visits and run ads to people who saw your menu.</p></div>
        </div>
        <label className="field" htmlFor="mk-meta">Meta Pixel ID <span className="mk-sub">Facebook &amp; Instagram</span>
          <input id="mk-meta" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="e.g. 1234567890123456" inputMode="numeric" translate="no" />
          <small>Events Manager → Data sources → your pixel → the ID under its name.</small>
        </label>
        <label className="field" htmlFor="mk-google">Google tag IDs <span className="mk-sub">Analytics, Ads, Tag Manager</span>
          <input id="mk-google" value={google} onChange={(e) => setGoogle(e.target.value)} placeholder="e.g. G-ABC123XYZ, AW-123456789, GTM-ABCD12" translate="no" />
          <small>Separate several IDs with commas. G-… for Google Analytics 4, AW-… for Google Ads, GTM-… for Tag Manager.</small>
        </label>
        <label className="field" htmlFor="mk-tiktok">TikTok Pixel ID
          <input id="mk-tiktok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="e.g. C4ABCD1234EFGH5678" translate="no" />
        </label>
        <div className="mk-events">
          <b>Events your menu sends</b>
          <ul><li><code>PageView</code> when the menu opens</li><li><code>ViewContent</code> when a guest opens a dish</li><li><code>AddToCart</code> when a dish is added</li><li><code>Purchase</code> when an order is placed, with its value</li></ul>
        </div>
        <div><button className="btn" type="submit" disabled={busy === "tags"}>{busy === "tags" ? "Saving…" : "Save tracking"}</button></div>
      </form>

      <form className="card" onSubmit={savePopup}>
        <div className="mk-head">
          <span className="mk-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="3" /><path d="M8 21l4-3 4 3M8 9h8M8 13h5" /></svg></span>
          <div><h3>Popup message</h3><p className="note">Show guests a message when they open your menu: a deal of the day, happy hour, an event or a new dish.</p></div>
          <button className="switch" type="button" role="switch" aria-checked={popup.enabled} aria-label="Show the popup" onClick={() => set({ enabled: !popup.enabled })} />
        </div>
        <div className="mk-popup">
          <div className="mk-fields">
            <div className="field">Image <span className="mk-sub">optional</span>
              <div className="mk-img">
                {popup.image_path ? <img src={photoUrl(popup.image_path)!} alt="" /> : <span className="mk-img-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></svg></span>}
                <div className="mk-img-actions">
                  <label className="btn ghost sm" style={{ cursor: "pointer" }}>{uploading ? "Uploading…" : popup.image_path ? "Replace image" : "Upload image"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
                  </label>
                  {popup.image_path && <button type="button" className="btn ghost sm" onClick={() => set({ image_path: null })}>Remove</button>}
                  <small>A dish, a flyer or your event. Shown at the top of the popup.</small>
                </div>
              </div>
            </div>
            <label className="field" htmlFor="mk-title">Title<input id="mk-title" value={popup.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Happy hour 5–7 pm" /></label>
            <label className="field" htmlFor="mk-body">Message<textarea id="mk-body" value={popup.body} maxLength={400} onChange={(e) => set({ body: e.target.value })} placeholder="e.g. Every cocktail is half price. Just ask your waiter." /></label>
            <div className="row2">
              <label className="field" htmlFor="mk-cta">Button text <span className="mk-sub">optional</span><input id="mk-cta" value={popup.cta_label} maxLength={30} onChange={(e) => set({ cta_label: e.target.value })} placeholder="e.g. Follow us" /></label>
              <label className="field" htmlFor="mk-url">Button link<input id="mk-url" value={popup.cta_url} onChange={(e) => set({ cta_url: e.target.value })} placeholder="https://instagram.com/…" translate="no" /></label>
            </div>
            <div className="row2">
              <label className="field" htmlFor="mk-delay">Show after
                <select id="mk-delay" value={popup.delay} onChange={(e) => set({ delay: Number(e.target.value) })}>{[0, 2, 3, 5, 10, 20].map((s) => <option key={s} value={s}>{s === 0 ? "Right away" : `${s} seconds`}</option>)}</select>
              </label>
              <label className="field" htmlFor="mk-freq">How often
                <select id="mk-freq" value={popup.frequency} onChange={(e) => set({ frequency: e.target.value as Popup["frequency"] })}><option value="once">Once per guest</option><option value="every">Every visit</option></select>
              </label>
            </div>
            <small className="note">Shown in your menu’s languages: it’s translated with the rest of your menu.</small>
          </div>
          <div className="mk-preview" aria-label="Popup preview">
            <span className="mk-preview-label">Preview</span>
            <div className="mk-pop" translate="no">
              <i>×</i>
              {popup.image_path && <img className="mk-pop-img" src={photoUrl(popup.image_path)!} alt="" />}
              {popup.title ? <b>{popup.title}</b> : !popup.body && !popup.image_path && <b className="ph">Your title</b>}
              {popup.body && <p>{popup.body}</p>}
              <span className="mk-pop-btn" style={{ background: venue.brand }}>{popup.cta_label || "Close"}</span>
            </div>
          </div>
        </div>
        <div><button className="btn" type="submit" disabled={busy === "popup"}>{busy === "popup" ? "Saving…" : "Save popup"}</button></div>
      </form>
    </div>
  );
}
