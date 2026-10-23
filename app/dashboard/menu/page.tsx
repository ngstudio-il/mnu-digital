"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { dishPrice, money, photoUrl } from "@/lib/format";
import type { Category, Dish } from "@/lib/types";
import ImportMenu from "@/components/dashboard/ImportMenu";
import ImagePacks from "@/components/dashboard/ImagePacks";
import BulkPhotos from "@/components/dashboard/BulkPhotos";
import { Grip, SortableList } from "@/components/dashboard/Sortable";
import { syncTranslations } from "@/lib/translate-client";
import GuestView from "@/components/dashboard/GuestView";
import DishEditor, { type Draft } from "@/components/dashboard/DishEditor";


export default function MenuPage() {
  const priceText = (d: Dish) => { const p = dishPrice(d); return p ? `${p.from ? "from " : ""}${money(p.amount, venue.currency)}` : "No price"; };
  const { venue, toast } = useDash();
  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [active, setActive] = useState<string>("all");
  const [newCat, setNewCat] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  // On phones the categories sit in one scrolling row, so they reorder sideways.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const missingPhotos = (dishes ?? []).filter((d) => !d.image_path).length;

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [c, d] = await Promise.all([
      sb.from("categories").select("*").eq("venue_id", venue.id).order("position"),
      sb.from("dishes").select("*").eq("venue_id", venue.id).order("position").order("created_at"),
    ]);
    setCats(c.data ?? []);
    setDishes(d.data ?? []);
    setPreviewVersion((v) => v + 1);
  }, [venue.id]);
  useEffect(() => { load(); }, [load]);

  // Keep translations in step with the menu: a few seconds after names, descriptions or labels change.
  const translates = venue.langs.some((l) => l !== (venue.primary_lang || "en"));
  const contentSig = dishes ? JSON.stringify([cats.map((c) => c.name), dishes.map((d) => [d.name, d.description, d.tags])]) : "";
  useEffect(() => {
    if (!translates || !contentSig) return;
    const t = setTimeout(() => { syncTranslations(); }, 2500);
    return () => clearTimeout(t);
  }, [translates, contentSig]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("images") === "bought") {
      toast("Thanks! Your AI images were added.");
      window.history.replaceState(null, "", "/dashboard/menu");
    }
  }, [toast]);

  const catOrder = new Map(cats.map((c, i) => [c.id, i]));
  const list = (dishes ?? [])
    .filter((d) => active === "all" || d.category_id === active)
    .sort((a, b) => (catOrder.get(a.category_id ?? "") ?? 999) - (catOrder.get(b.category_id ?? "") ?? 999) || a.position - b.position);

  // Reorders show in the Guest View right away, before they are saved.
  const preview = useRef<HTMLIFrameElement>(null);
  const tellPreview = (msg: object) => preview.current?.contentWindow?.postMessage({ type: "mnu:order", ...msg }, window.location.origin);

  async function reorderCats(next: Category[]) {
    setCats(next.map((c, i) => ({ ...c, position: i })));
    tellPreview({ cats: next.map((c) => c.id) });
    const sb = supabaseBrowser();
    const results = await Promise.all(next.map((c, i) => sb.from("categories").update({ position: i }).eq("id", c.id)));
    if (results.some((r) => r.error)) { toast("Couldn’t save the new order."); load(); } else toast("Category order saved");
  }
  async function reorderDishes(next: Dish[]) {
    const pos = new Map(next.map((d, i) => [d.id, i]));
    tellPreview({ dishes: next.map((d, i) => ({ id: d.id, position: i })) });
    setDishes((all) => all?.map((d) => (pos.has(d.id) ? { ...d, position: pos.get(d.id)! } : d)) ?? null);
    const sb = supabaseBrowser();
    const results = await Promise.all(next.map((d, i) => sb.from("dishes").update({ position: i }).eq("id", d.id)));
    if (results.some((r) => r.error)) { toast("Couldn’t save the new order."); load(); } else toast("Dish order saved");
  }
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
    setDraft({ name: "", description: "", price: "", category_id: active !== "all" ? active : cats[0]?.id ?? null, image_path: null, available: true, tags: [], options: [] });
  }
  function openEdit(d: Dish) {
    setDraft({ id: d.id, name: d.name, description: d.description, price: d.price === null ? "" : String(d.price), options: (d.options ?? []).map((o) => ({ name: o.name, price: o.price === null ? "" : String(o.price) })), category_id: d.category_id, image_path: d.image_path, image_ai: d.image_ai ?? false, available: d.available, tags: d.tags ?? [] });
  }

  return (
    <>
      <div className="menu-grid">
        <div>
          <div className="cats">
            <button type="button" aria-pressed={active === "all"} onClick={() => setActive("all")}>All<span>{dishes?.length ?? 0}</span></button>
            <SortableList items={cats} onReorder={reorderCats} horizontal={narrow} render={(c, h, dragging) => (
              <div className={`cat-row${dragging ? " dragging" : ""}`}>
                <Grip handle={h} label={c.name} />
                <button type="button" aria-pressed={active === c.id} onClick={() => setActive(c.id)}>
                  {c.name}<span>{(dishes ?? []).filter((d) => d.category_id === c.id).length}</span>
                </button>
              </div>
            )} />
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
          <div className="card-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 18 }}>{activeName}</h3><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{missingPhotos > 0 && <button className="ai-btn" type="button" onClick={() => setBulk(true)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>Photos for {missingPhotos} dish{missingPhotos === 1 ? "" : "es"}</button>}<button className="btn ghost sm" type="button" onClick={() => setImporting(true)}>Import menu</button><button className="btn sm" type="button" onClick={openNew}>+ Add dish</button></div></div>
          {dishes === null ? <p className="note">Loading your menu…</p> : list.length ? (
            <div className="dish-list">
              {active === "all" && list.length > 1 && <p className="note reorder-hint">To change the order of dishes, open a category and drag them.</p>}
              <SortableList items={list} onReorder={reorderDishes} disabled={active === "all"} render={(d, h, dragging) => {
                const src = photoUrl(d.image_path);
                return (
                  <div className={`dish-row${d.available ? "" : " off"}${h ? " sortable" : ""}${dragging ? " dragging" : ""}`}>
                    <Grip handle={h} label={d.name} />
                    {src ? <img src={src} alt="" /> : <span className="thumb-empty" />}
                    <div>
                      <b>{d.name}</b><p>{d.description || "No description"}</p>
                      {d.tags?.length > 0 && <div className="tags">{d.tags.map((t) => <span key={t}>{t}</span>)}</div>}
                    </div>
                    <span className="price">{priceText(d)}</span>
                    <button className="switch" type="button" role="switch" aria-checked={d.available} aria-label={`${d.name} available`} onClick={() => toggle(d)} />
                    <button className="btn ghost sm" type="button" onClick={() => openEdit(d)}>Edit</button>
                  </div>
                );
              }} />
            </div>
          ) : (
            <div className="empty"><b>No dishes here yet</b>Upload a photo or PDF of your current menu and we’ll fill it in for you, or add dishes one by one.<br /><br /><div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><button className="btn sm" type="button" onClick={() => setImporting(true)}>Import from photo or PDF</button><button className="btn ghost sm" type="button" onClick={openNew}>+ Add dish</button></div></div>
          )}
        </div>

        <GuestView ref={preview} slug={venue.slug} version={previewVersion} note="Updates after you save a dish or change the order." />
      </div>
      {bulk && <BulkPhotos missing={missingPhotos} onClose={() => { setBulk(false); load(); }} onProgress={load} />}
      {importing && <ImportMenu cats={cats} onClose={() => setImporting(false)} onDone={() => { setImporting(false); setActive("all"); load(); }} />}
      {draft && <DishEditor draft={draft} cats={cats} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />}
    </>
  );
}
