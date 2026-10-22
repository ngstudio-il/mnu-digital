"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { LABELS, money, photoUrl } from "@/lib/format";
import type { Category, Dish } from "@/lib/types";
import ImportMenu from "@/components/dashboard/ImportMenu";

type Draft = { id?: string; name: string; description: string; price: string; category_id: string | null; image_path: string | null; available: boolean; tags: string[] };

export default function MenuPage() {
  const { venue, toast } = useDash();
  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [active, setActive] = useState<string>("all");
  const [newCat, setNewCat] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [c, d] = await Promise.all([
      sb.from("categories").select("*").eq("venue_id", venue.id).order("position"),
      sb.from("dishes").select("*").eq("venue_id", venue.id).order("position").order("created_at"),
    ]);
    setCats(c.data ?? []);
    setDishes(d.data ?? []);
  }, [venue.id]);
  useEffect(() => { load(); }, [load]);

  const list = (dishes ?? []).filter((d) => active === "all" || d.category_id === active);
  const activeName = active === "all" ? "All dishes" : cats.find((c) => c.id === active)?.name ?? "Dishes";

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) return toast(`${name} already exists`);
    const { data, error } = await supabaseBrowser().from("categories").insert({ venue_id: venue.id, name, position: cats.length }).select().single();
    if (error || !data) return toast("Couldn’t add the category.");
    setCats([...cats, data]); setActive(data.id); setNewCat(""); toast("Category added");
  }

  async function removeCategory(c: Category) {
    const n = (dishes ?? []).filter((d) => d.category_id === c.id).length;
    if (n > 0) return toast(`Move or delete the ${n} dish${n > 1 ? "es" : ""} in ${c.name} first`);
    await supabaseBrowser().from("categories").delete().eq("id", c.id);
    setCats(cats.filter((x) => x.id !== c.id)); setActive("all"); toast("Category removed");
  }

  async function toggle(d: Dish) {
    setDishes((l) => l?.map((x) => (x.id === d.id ? { ...x, available: !d.available } : x)) ?? null);
    const { error } = await supabaseBrowser().from("dishes").update({ available: !d.available }).eq("id", d.id);
    if (error) { toast("Couldn’t update the dish."); load(); return; }
    toast(!d.available ? `${d.name} is back on the menu` : `${d.name} marked sold out`);
  }

  function openNew() {
    setDraft({ name: "", description: "", price: "", category_id: active !== "all" ? active : cats[0]?.id ?? null, image_path: null, available: true, tags: [] });
  }
  function openEdit(d: Dish) {
    setDraft({ id: d.id, name: d.name, description: d.description, price: String(d.price), category_id: d.category_id, image_path: d.image_path, available: d.available, tags: d.tags ?? [] });
  }

  return (
    <>
      <div className="menu-grid">
        <div>
          <div className="cats">
            <button type="button" aria-pressed={active === "all"} onClick={() => setActive("all")}>All<span>{dishes?.length ?? 0}</span></button>
            {cats.map((c) => (
              <button key={c.id} type="button" aria-pressed={active === c.id} onClick={() => setActive(c.id)}>
                {c.name}<span>{(dishes ?? []).filter((d) => d.category_id === c.id).length}</span>
              </button>
            ))}
          </div>
          <form className="add-cat" onSubmit={addCategory}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" aria-label="New category name" />
            <button className="btn sm" type="submit">Add</button>
          </form>
          {active !== "all" && (
            <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => { const c = cats.find((x) => x.id === active); if (c) removeCategory(c); }}>Remove this category</button>
          )}
        </div>

        <div>
          <div className="card-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 18 }}>{activeName}</h3><div style={{ display: "flex", gap: 8 }}><button className="btn ghost sm" type="button" onClick={() => setImporting(true)}>Import menu</button><button className="btn sm" type="button" onClick={openNew}>+ Add dish</button></div></div>
          {dishes === null ? <p className="note">Loading your menu…</p> : list.length ? (
            <div className="dish-list">
              {list.map((d) => {
                const src = photoUrl(d.image_path);
                return (
                  <div className={`dish-row${d.available ? "" : " off"}`} key={d.id}>
                    {src ? <img src={src} alt="" /> : <span className="thumb-empty" />}
                    <div>
                      <b>{d.name}</b><p>{d.description || "No description"}</p>
                      {d.tags?.length > 0 && <div className="tags">{d.tags.map((t) => <span key={t}>{t}</span>)}</div>}
                    </div>
                    <span className="price">{money(d.price, venue.currency)}</span>
                    <button className="switch" type="button" role="switch" aria-checked={d.available} aria-label={`${d.name} available`} onClick={() => toggle(d)} />
                    <button className="btn ghost sm" type="button" onClick={() => openEdit(d)}>Edit</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty"><b>No dishes here yet</b>Upload a photo or PDF of your current menu and we’ll fill it in for you, or add dishes one by one.<br /><br /><div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><button className="btn sm" type="button" onClick={() => setImporting(true)}>Import from photo or PDF</button><button className="btn ghost sm" type="button" onClick={openNew}>+ Add dish</button></div></div>
          )}
        </div>

        <div className="preview">
          <small>Guest view</small>
          <div className="pv-phone"><div className="pv-screen">
            <div className="pv-head" style={{ background: venue.brand }}>{photoUrl(venue.logo_path) && <img className="pv-logo" src={photoUrl(venue.logo_path)!} alt="" />}<small>{venue.type.toUpperCase()}</small><b>{venue.name}</b></div>
            <div className="pv-list">
              {cats.map((c) => {
                const ds = (dishes ?? []).filter((d) => d.category_id === c.id && d.available);
                if (!ds.length) return null;
                return (
                  <div key={c.id}>
                    <div className="pv-cat" style={{ color: venue.brand }}>{c.name}</div>
                    {ds.map((d) => { const src = photoUrl(d.image_path); return (
                      <div className="pv-item" key={d.id}>{src ? <img src={src} alt="" /> : <span className="thumb-empty" />}<div><b>{d.name}</b><span>{d.description}</span></div><em>{money(d.price, venue.currency)}</em></div>
                    ); })}
                  </div>
                );
              })}
            </div>
          </div></div>
        </div>
      </div>
      {importing && <ImportMenu cats={cats} onClose={() => setImporting(false)} onDone={() => { setImporting(false); setActive("all"); load(); }} />}
      {draft && <DishEditor draft={draft} cats={cats} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />}
    </>
  );
}

function DishEditor({ draft, cats, onClose, onSaved }: { draft: Draft; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const { venue, toast } = useDash();
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

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return setErr("Choose an image file (JPG, PNG or WebP).");
    if (file.size > 5 * 1024 * 1024) return setErr("That photo is over 5 MB. Choose a smaller one.");
    setUploading(true); setErr("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${venue.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("dish-photos").upload(path, file, { cacheControl: "31536000", contentType: file.type });
    setUploading(false);
    if (error) return setErr("Upload failed: " + error.message);
    set({ image_path: path });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return setErr("Give the dish a name.");
    const price = parseFloat(d.price);
    if (isNaN(price) || price < 0) return setErr("Enter a price, for example 18.");
    setBusy(true);
    const row = { venue_id: venue.id, name: d.name.trim(), description: d.description.trim(), price, category_id: d.category_id, image_path: d.image_path, available: d.available, tags: d.tags };
    const sb = supabaseBrowser();
    const { error } = d.id ? await sb.from("dishes").update(row).eq("id", d.id) : await sb.from("dishes").insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
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
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="m-title" onSubmit={save} noValidate>
        <div className="modal-head"><h3 id="m-title">{d.id ? "Edit dish" : "New dish"}</h3><button className="x" type="button" onClick={onClose} aria-label="Close">×</button></div>
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
          <small>{ai.msg ? <span style={{ color: "var(--coral)" }}>{ai.msg}</span> : aiLeft !== null ? `${aiLeft} of ${ai.quota} AI descriptions left this month` : "AI uses the dish name, category, labels and anything you type here."}</small>
        </div>
        <div className="row2">
          <label className="field" htmlFor="d-price">Price ({venue.currency})<input id="d-price" type="number" min="0" step="0.5" value={d.price} onChange={(e) => set({ price: e.target.value })} /></label>
          <label className="field" htmlFor="d-cat">Category
            <select id="d-cat" value={d.category_id ?? ""} onChange={(e) => set({ category_id: e.target.value || null })}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div>
          <p className="fieldset-label">Photo</p>
          <div className="photo-pick">
            {src && <button type="button" aria-pressed="true" aria-label="Current photo"><img src={src} alt="" /></button>}
            <label className="btn ghost sm" style={{ alignSelf: "center", cursor: "pointer" }}>
              {uploading ? "Uploading…" : src ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
            {src && <button type="button" className="btn ghost sm" style={{ width: "auto", height: "auto", alignSelf: "center" }} onClick={() => set({ image_path: null })}>Remove</button>}
          </div>
        </div>
        <div>
          <p className="fieldset-label">Labels</p>
          <div className="chips">{LABELS.map((t) => (
            <button key={t} type="button" aria-pressed={d.tags.includes(t)} onClick={() => set({ tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] })}>{t}</button>
          ))}</div>
        </div>
        <div className="inline">Available on the menu <button className="switch" type="button" role="switch" aria-checked={d.available} aria-label="Available" onClick={() => set({ available: !d.available })} /></div>
        {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
        <div className="modal-foot">
          <div>{d.id && <button className="btn danger" type="button" onClick={remove} disabled={busy}>Delete dish</button>}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn" type="submit" disabled={busy || uploading}>{busy ? "Saving…" : d.id ? "Save dish" : "Add dish"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
