"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "./VenueContext";
import { LABELS, photoUrl } from "@/lib/format";
import type { Category, Dish } from "@/lib/types";
import ImagePacks from "./ImagePacks";

export type Draft = { id?: string; name: string; description: string; price: string; category_id: string | null; image_path: string | null; image_ai?: boolean; available: boolean; tags: string[]; options: { name: string; price: string }[] };

// Adding or editing a dish, on a page of its own over the menu.
export default function DishEditor({ draft, cats, onClose, onSaved }: { draft: Draft; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const { venue, setVenue, toast } = useDash();
  const [newLabel, setNewLabel] = useState("");
  const [editLabels, setEditLabels] = useState(false);
  const labels = venue.labels?.length ? venue.labels : LABELS;

  async function saveLabels(next: string[], msg: string) {
    const { data, error } = await supabaseBrowser().from("venues").update({ labels: next }).eq("id", venue.id).select().single();
    if (error || !data) return toast(error?.message.includes("labels") ? "Labels need a database update first." : "Couldn’t save labels.");
    setVenue(data);
    toast(msg);
  }
  function addLabel() {
    const t = newLabel.trim().slice(0, 30);
    if (!t) return;
    if (labels.some((l) => l.toLowerCase() === t.toLowerCase())) { setNewLabel(""); return toast(`${t} already exists`); }
    saveLabels([...labels, t], `Label “${t}” added`);
    set({ tags: [...d.tags, t] });
    setNewLabel("");
  }
  const [d, setD] = useState<Draft>(draft);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ai, setAi] = useState<{ busy: boolean; used: number | null; quota: number | null; msg: string }>({ busy: false, used: null, quota: null, msg: "" });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    supabaseBrowser().rpc("ai_quota", { p_venue: venue.id }).then(({ data }: { data: { used: number; quota: number }[] | null }) => {
      const q = data?.[0];
      if (q) setAi((a) => ({ ...a, used: q.used, quota: q.quota }));
    });
  }, [venue.id]);

  async function writeWithAi() {
    if (!d.name.trim()) return setAi((a) => ({ ...a, msg: "Add the dish name first." }));
    setAi((a) => ({ ...a, busy: true, msg: "" }));
    const res = await fetch("/api/ai/describe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: d.name, category: cats.find((c) => c.id === d.category_id)?.name, tags: d.tags, notes: d.description, venueType: venue.type }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) return setAi((a) => ({ ...a, busy: false, msg: json.error ?? "Couldn’t reach the AI service." }));
    set({ description: json.text });
    setAi((a) => ({ ...a, busy: false, used: json.used ?? a.used, quota: json.quota ?? a.quota }));
  }
  const aiLeft = ai.quota !== null && ai.used !== null ? Math.max(0, ai.quota - ai.used) : null;

  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    // Escape closes the enlarged photo first, then the editor.
    const esc = (e: KeyboardEvent) => { if (e.key !== "Escape") return; if (zoom) setZoom(false); else onClose(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose, zoom]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return setErr("Choose an image file (JPG, PNG or WebP).");
    if (file.size > 5 * 1024 * 1024) return setErr("That photo is over 5 MB. Choose a smaller one.");
    setUploading(true); setErr("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${venue.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("dish-photos").upload(path, file, { cacheControl: "31536000", contentType: file.type });
    setUploading(false);
    if (error) return setErr("Upload failed: " + error.message);
    set({ image_path: path, image_ai: false });
  }

  const [img, setImg] = useState<{ busy: "" | "create" | "enhance"; used: number | null; quota: number | null; extra: number; msg: string; out: boolean; packs: boolean }>({ busy: "", used: null, quota: null, extra: 0, msg: "", out: false, packs: false });
  useEffect(() => {
    supabaseBrowser().rpc("image_quota", { p_venue: venue.id }).then(({ data }: { data: { used: number; quota: number; extra: number }[] | null }) => {
      const q = data?.[0];
      if (q) setImg((a) => ({ ...a, used: q.used, quota: q.quota, extra: q.extra }));
    });
  }, [venue.id]);
  const imgLeft = img.quota !== null && img.used !== null ? Math.max(0, img.quota - img.used) + img.extra : null;

  async function aiImage(mode: "create" | "enhance") {
    if (!d.name.trim()) return setImg((a) => ({ ...a, msg: "Add the dish name first." }));
    setImg((a) => ({ ...a, busy: mode, msg: "" }));
    const res = await fetch("/api/ai/image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, name: d.name, description: d.description, imagePath: d.image_path }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) return setImg((a) => ({ ...a, busy: "", msg: json.error ?? "Couldn’t create the image.", out: Boolean(json.outOfCredits) }));
    set({ image_path: json.path, image_ai: Boolean(json.ai) });
    setImg((a) => ({ ...a, busy: "", used: json.used, quota: json.quota, extra: json.extra, out: false }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return setErr("Give the dish a name.");
    // Price is optional: leave it empty for a menu that's only a catalogue.
    const num = (v: string) => (v.trim() === "" ? null : parseFloat(v));
    const price = num(d.price);
    if (price !== null && (isNaN(price) || price < 0)) return setErr("Enter a price like 18, or leave it empty.");
    const options = d.options.filter((o) => o.name.trim() || o.price.trim()).map((o) => ({ name: o.name.trim().slice(0, 40), price: num(o.price) }));
    if (options.some((o) => !o.name)) return setErr("Give every variation a name, or remove it.");
    if (options.some((o) => o.price !== null && (isNaN(o.price) || o.price < 0))) return setErr("Variation prices must be numbers like 14, or empty to use the dish price.");
    if (new Set(options.map((o) => o.name.toLowerCase())).size !== options.length) return setErr("Two variations have the same name.");
    setBusy(true);
    const row = { venue_id: venue.id, name: d.name.trim(), description: d.description.trim(), price, options, category_id: d.category_id, image_path: d.image_path, image_ai: Boolean(d.image_path && d.image_ai), available: d.available, tags: d.tags };
    const sb = supabaseBrowser();
    const { error } = d.id ? await sb.from("dishes").update(row).eq("id", d.id) : await sb.from("dishes").insert(row);
    setBusy(false);
    if (error) return setErr(/options|null value in column "price"/.test(error.message) ? "Optional prices and variations need a database update first (0015_variations_optional_price.sql)." : error.message);
    toast(d.id ? "Saved. Your menu is updated." : `${row.name} added to the menu`);
    onSaved();
  }

  async function remove() {
    if (!d.id) return;
    setBusy(true);
    await supabaseBrowser().from("dishes").delete().eq("id", d.id);
    toast("Dish deleted");
    onSaved();
  }

  const src = photoUrl(d.image_path);
  return (
    <div className="editor-page">
      <form className="editor" role="dialog" aria-modal="true" aria-labelledby="m-title" onSubmit={save} noValidate>
        <header className="editor-head">
          <button className="editor-back" type="button" onClick={onClose} aria-label="Back to the menu">←</button>
          <h3 id="m-title">{d.id ? "Edit dish" : "New dish"}</h3>
          <div className="editor-actions">
            <button className="btn ghost sm" type="button" onClick={onClose}>Cancel</button>
            <button className="btn sm" type="submit" disabled={busy || uploading}>{busy ? "Saving…" : d.id ? "Save dish" : "Add dish"}</button>
          </div>
        </header>
        <div className="editor-body">
        <div className="editor-main">
        <label className="field" htmlFor="d-name">Dish name<input id="d-name" autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Grilled salmon" /></label>
        <div className="field">
          <div className="ai-row">
            <label htmlFor="d-desc">Description</label>
            <div className="ai-tools">
              <button className={`ai-btn${ai.busy ? " busy" : ""}`} type="button" onClick={writeWithAi} disabled={ai.busy || aiLeft === 0}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>
                {ai.busy ? "Writing…" : "Write with AI"}
              </button>
            </div>
          </div>
          <textarea id="d-desc" value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ingredients, how it’s served. Jot a few words and let AI polish them." />
          <small>{ai.msg ? <span style={{ color: "var(--coral)" }}>{ai.msg}</span> : aiLeft !== null ? `${aiLeft} of ${ai.quota} AI text credits left this month` : "AI uses the dish name, category, labels and anything you type here."}</small>
        </div>
        <label className="field" htmlFor="d-cat">Category
          <select id="d-cat" value={d.category_id ?? ""} onChange={(e) => set({ category_id: e.target.value || null })}>
            <option value="">No category</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <section className="sub-section" aria-labelledby="sec-price">
          <div className="sub-section-head"><b id="sec-price">Pricing</b><span>Optional. Leave it empty if your menu is only a catalogue.</span></div>
          <label className="field" htmlFor="d-price">Price
            <span className="money-input"><i>{venue.currency}</i><input id="d-price" type="number" min="0" step="0.5" inputMode="decimal" value={d.price} placeholder="No price" onChange={(e) => set({ price: e.target.value })} /></span>
          </label>
          <div className="variations">
            <div className="variations-head"><b>Variations</b><span>Sizes or versions guests choose from, like Short and Long for a coffee. An empty price uses the dish price.</span></div>
            {d.options.map((o, i) => (
              <div className="variation" key={i}>
                <input value={o.name} placeholder={i === 0 ? "e.g. Short" : i === 1 ? "e.g. Long" : "Name"} aria-label={`Variation ${i + 1} name`} maxLength={40}
                  onChange={(e) => set({ options: d.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <span className="money-input"><i>{venue.currency}</i><input type="number" min="0" step="0.5" inputMode="decimal" value={o.price} placeholder={d.price || "–"} aria-label={`Variation ${i + 1} price`}
                  onChange={(e) => set({ options: d.options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} /></span>
                <button type="button" className="variation-x" aria-label={`Remove variation ${i + 1}`} onClick={() => set({ options: d.options.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="add-variation" onClick={() => set({ options: [...d.options, { name: "", price: "" }] })} disabled={d.options.length >= 12}>+ Add variation</button>
          </div>
        </section>

        <section className="sub-section" aria-labelledby="sec-labels">
          <div className="sub-section-head row">
            <div><b id="sec-labels">Labels</b><span>Shown on the dish so guests can spot dietary needs.</span></div>
            <button type="button" className="link-btn" onClick={() => setEditLabels((v) => !v)}>{editLabels ? "Done" : "Manage labels"}</button>
          </div>
          <div className="chips">
            {[...labels, ...d.tags.filter((t) => !labels.includes(t))].map((t) => editLabels ? (
              <span key={t} className="chip-edit">{t}<button type="button" aria-label={`Delete label ${t}`} onClick={() => { saveLabels(labels.filter((x) => x !== t), `Label “${t}” removed`); set({ tags: d.tags.filter((x) => x !== t) }); }}>×</button></span>
            ) : (
              <button key={t} type="button" aria-pressed={d.tags.includes(t)} onClick={() => set({ tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] })}>{t}</button>
            ))}
          </div>
          <div className="add-label">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }} placeholder="New label, e.g. Chef’s pick" aria-label="New label" maxLength={30} />
            <button type="button" className="btn ghost sm" onClick={addLabel} disabled={!newLabel.trim()}>Add</button>
          </div>
        </section>
        <div className="inline">Available on the menu <button className="switch" type="button" role="switch" aria-checked={d.available} aria-label="Available" onClick={() => set({ available: !d.available })} /></div>
        {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
        {d.id && <div className="editor-danger"><button className="btn danger sm" type="button" onClick={remove} disabled={busy}>Delete dish</button></div>}
        </div>
        <aside className="editor-side">
          <section className="photo-card" aria-label="Photo">
            <div className="photo-card-head"><b>Photo</b>{d.image_ai && src && <span className="photo-tag">AI illustration</span>}</div>
            {src ? (
              <button type="button" className="photo-view" onClick={() => setZoom(true)} aria-label="View the photo larger">
                <img src={src} alt="" />
                <span className="photo-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M11 8v6M8 11h6" /></svg></span>
                {img.busy && <span className="photo-busy">{img.busy === "enhance" ? "Enhancing…" : "Creating…"}</span>}
              </button>
            ) : (
              <label className="photo-empty">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></svg>
                <b>{uploading ? "Uploading…" : img.busy ? "Creating…" : "Upload a photo"}</b>
                <span>JPG, PNG or WebP. Or let AI create one.</span>
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
            )}
            <div className="photo-tools">
              {src && (
                <div className="photo-row">
                  <label className="photo-tool">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                    {uploading ? "Uploading…" : "Replace"}
                    <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                  </label>
                  <button type="button" className="photo-tool" onClick={() => set({ image_path: null, image_ai: false })}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>Remove
                  </button>
                </div>
              )}
              <div className="photo-row ai">
                <button type="button" className={`photo-tool ai${img.busy === "enhance" ? " busy" : ""}`} onClick={() => aiImage("enhance")} disabled={!!img.busy || !src} title={src ? "" : "Upload a photo first"}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>
                  {img.busy === "enhance" ? "Enhancing…" : "Enhance photo"}
                </button>
                <button type="button" className={`photo-tool ai${img.busy === "create" ? " busy" : ""}`} onClick={() => aiImage("create")} disabled={!!img.busy}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>
                  {img.busy === "create" ? "Creating…" : "Create with AI"}
                </button>
              </div>
            </div>
            <div className="photo-foot">
              <span>{img.busy ? "This takes about 10–20 seconds." : img.msg ? <span style={{ color: "var(--coral)" }}>{img.msg}</span> : imgLeft !== null ? `${imgLeft} AI image${imgLeft === 1 ? "" : "s"} left${img.extra ? ` (incl. ${img.extra} from packs)` : ""}` : ""}</span>
              <button type="button" className="link-btn" onClick={() => setImg((a) => ({ ...a, packs: true }))}>{img.out ? "Buy more images" : "Buy more"}</button>
            </div>
            {d.image_ai && src && <p className="note">Your menu shows a small “Illustration” tag on AI photos.</p>}
          </section>
          {img.packs && <ImagePacks onClose={() => setImg((a) => ({ ...a, packs: false }))} />}
        </aside>
        </div>
      </form>
      {zoom && src && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setZoom(false)}>
          <img src={src} alt={d.name} />
          <button type="button" className="x" onClick={() => setZoom(false)} aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}
