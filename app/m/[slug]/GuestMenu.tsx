"use client";
import "@/styles/guest.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import Sheet from "./Sheet";
import { money, photoUrl } from "@/lib/format";
import { fill, tkey, type ContentMap, type UiKey, type UiStrings } from "@/lib/i18n";
import { isRtl, language } from "@/lib/languages";
import { look } from "@/lib/themes";
import type { Category, Dish, Venue } from "@/lib/types";

type I18n = { primary: string; langs: string[]; content: ContentMap; ui: Record<string, UiStrings> };
type Props = { venue: Venue; categories: Category[]; dishes: Dish[]; table: string | null; i18n: I18n };
type Saved = { token: string | null; number: number; at: string; total: number; label: string; items: { name: string; qty: number; price: number }[] };
type Live = { token: string; status: string; total: number; items: { name: string; qty: number; price: number }[] };

const GUEST_STATUS: Record<string, [UiKey, string]> = {
  new: ["st_new", "st-new"],
  preparing: ["st_preparing", "st-preparing"],
  ready: ["st_ready", "st-ready"],
  done: ["st_done", "st-done"],
  cancelled: ["st_cancelled", "st-cancelled"],
};

export default function GuestMenu({ venue, categories, dishes, table, i18n }: Props) {
  const [lang, setLang] = useState(i18n.primary);
  const [pickLang, setPickLang] = useState(false);
  const langKey = `mnu.lang.${venue.slug}`;
  const ui = i18n.ui[lang] ?? i18n.ui[i18n.primary];
  const design = useMemo(() => look(venue), [venue]);
  const cover = photoUrl(venue.cover_path);
  const t = (k: UiKey, vars?: Record<string, string | number>) => fill(ui[k], vars);
  const tr = (key: string) => (lang === i18n.primary ? undefined : i18n.content[lang]?.[key]);
  const dishName = (d: Dish) => tr(tkey.dish(d.id))?.name || d.name;
  const dishDesc = (d: Dish) => (d.description ? tr(tkey.dish(d.id))?.description || d.description : "");
  const label = (x: string) => tr(tkey.label(x))?.name || x;
  const tableText = (label: string) => label.replace(/^Table (\d+)$/, (_, n) => t("tableN", { n }));

  // Saved choice first, then the phone's own language when the menu offers it.
  useEffect(() => {
    let pick: string | null = null;
    try { pick = localStorage.getItem(langKey); } catch { /* storage unavailable */ }
    if (!pick || !i18n.langs.includes(pick)) {
      const wanted = (navigator.languages ?? [navigator.language]).map((l) => l.toLowerCase());
      pick = wanted.map((w) => i18n.langs.find((l) => l.toLowerCase() === w) ?? i18n.langs.find((l) => l.toLowerCase() === w.split("-")[0])).find(Boolean) ?? null;
    }
    if (pick && pick !== i18n.primary) setLang(pick);
  }, [langKey, i18n.langs, i18n.primary]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);
  function chooseLang(l: string) {
    setLang(l); setPickLang(false);
    try { localStorage.setItem(langKey, l); } catch { /* storage unavailable */ }
  }
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Dish | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [type, setType] = useState<"dinein" | "takeaway">(table && venue.dinein ? "dinein" : venue.takeaway ? "takeaway" : "dinein");
  const [tableNo, setTableNo] = useState(table ?? "");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [mine, setMine] = useState<Saved[]>([]);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [showMine, setShowMine] = useState(false);
  const storeKey = `mnu.orders.${venue.slug}`;

  // Orders placed from this phone in the last 24 hours, kept only on the guest's device.
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(storeKey) ?? "[]") as Saved[];
      setMine(all.filter((o) => Date.now() - new Date(o.at).getTime() < 86400000));
    } catch { /* storage unavailable */ }
  }, [storeKey]);

  const refreshLive = useCallback(async () => {
    const tokens = mine.map((o) => o.token).filter(Boolean) as string[];
    if (!tokens.length) return;
    const { data } = await supabaseBrowser().rpc("guest_orders", { p_tokens: tokens });
    if (Array.isArray(data)) setLive(Object.fromEntries((data as Live[]).map((o) => [o.token, o])));
  }, [mine]);

  useEffect(() => {
    if (!showMine) return;
    refreshLive();
    const t = setInterval(() => { if (!document.hidden) refreshLive(); }, 10000);
    return () => clearInterval(t);
  }, [showMine, refreshLive]);

  const groups = useMemo(() => {
    const g = categories.map((c) => ({ id: c.id, name: (lang !== i18n.primary && i18n.content[lang]?.[tkey.cat(c.id)]?.name) || c.name, items: dishes.filter((d) => d.category_id === c.id) })).filter((g) => g.items.length);
    const loose = dishes.filter((d) => !d.category_id || !categories.some((c) => c.id === d.category_id));
    if (loose.length) g.push({ id: "other", name: ui.more, items: loose });
    return g;
  }, [categories, dishes, lang, i18n, ui]);

  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ dish: dishes.find((d) => d.id === id)!, q })).filter((l) => l.dish);
  const count = lines.reduce((t, l) => t + l.q, 0);
  const total = lines.reduce((t, l) => t + l.q * Number(l.dish.price), 0);
  const canOrder = venue.ordering_on && (venue.dinein || venue.takeaway);
  const add = (id: string, n = 1) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + n) }));

  async function place() {
    setErr("");
    if (type === "dinein" && !tableNo.trim()) return setErr(t("errTable"));
    if (type === "takeaway" && !name.trim()) return setErr(t("errName"));
    setBusy(true);
    const label = type === "dinein" ? (table ?? (/^\d+$/.test(tableNo.trim()) ? `Table ${tableNo.trim()}` : tableNo.trim())) : "Takeaway";
    const args = {
      p_slug: venue.slug, p_table: label, p_type: type, p_name: name.trim() || null, p_note: note.trim() || null,
      p_items: lines.map((l) => ({ dish_id: l.dish.id, qty: l.q })),
    };
    const sb = supabaseBrowser();
    let number: number | null = null;
    let token: string | null = null;
    const v2 = await sb.rpc("place_order_v2", args);
    if (!v2.error) { number = (v2.data as { number: number; token: string }).number; token = (v2.data as { number: number; token: string }).token; }
    else if (v2.error.code === "PGRST202") {
      // Tracking isn't set up in the database yet: place the order the old way.
      const v1 = await sb.rpc("place_order", args);
      if (v1.error) { setBusy(false); return setErr(v1.error.message.replace(/^.*?: /, "")); }
      number = v1.data as number;
    } else { setBusy(false); return setErr(v2.error.message.replace(/^.*?: /, "")); }
    setBusy(false);
    const saved: Saved = { token, number: number!, at: new Date().toISOString(), total, label: type === "dinein" ? label : `Takeaway · ${name.trim()}`, items: lines.map((l) => ({ name: l.dish.name, qty: l.q, price: Number(l.dish.price) })) };
    const next = [saved, ...mine].slice(0, 20);
    setMine(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
    setPlaced(number); setCart({}); setCheckout(false);
  }

  return (
    <div className={`g ${design.className}`} lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <style>{design.css}</style>
      {design.fonts && <link rel="stylesheet" href={design.fonts} precedence="default" />}
      <header className={`g-head${cover ? " has-cover" : ""}`} style={cover ? { ["--cover" as string]: `url("${cover}")` } : undefined}>
        {photoUrl(venue.logo_path) && <img className="g-logo" src={photoUrl(venue.logo_path)!} alt={`${venue.name} logo`} />}
        <small>{(ui[`type_${venue.type}` as UiKey] ?? venue.type).toUpperCase()}</small>
        <h1>{venue.name}</h1>
        {table && <span className="g-table">{tableText(table)}</span>}
        <div className="g-top">
          {mine.length > 0 && <button type="button" className="g-mine" onClick={() => setShowMine(true)}>{t("myOrders")} · {mine.length}</button>}
          {i18n.langs.length > 1 && (
            <button type="button" className="g-lang" onClick={() => setPickLang(true)} aria-label={t("language")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
              {language(lang).native}
            </button>
          )}
        </div>
      </header>
      <nav className="g-cats" aria-label={t("menu")}>{groups.map((g) => <a key={g.id} href={`#c-${g.id}`}>{g.name}</a>)}</nav>

      <main className="g-list">
        {groups.length === 0 && <p className="g-empty">{t("empty")}</p>}
        {groups.map((g) => (
          <section key={g.id} id={`c-${g.id}`}>
            <h2>{g.name}</h2>
            {g.items.map((d) => { const src = photoUrl(d.image_path); return (
              <article className={`g-item${src ? "" : " noimg"}`} key={d.id} onClick={() => setOpen(d)}>
                {src && <span className="g-img">{<img src={src} alt="" />}{d.image_ai && <i>{t("illustration")}</i>}</span>}
                <div className="g-info"><b>{dishName(d)}</b><p>{dishDesc(d)}</p>{d.tags?.length > 0 && <div className="g-tags">{d.tags.map((x) => <span key={x}>{label(x)}</span>)}</div>}</div>
                <div className="g-side"><em>{money(d.price, venue.currency)}</em>
                  {canOrder && (cart[d.id] ? (
                    <div className="g-qty" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => add(d.id, -1)} aria-label={`${t("removeOne")}: ${dishName(d)}`}>−</button><span>{cart[d.id]}</span><button type="button" onClick={() => add(d.id)} aria-label={`${t("addOne")}: ${dishName(d)}`}>+</button></div>
                  ) : <button className="g-add" type="button" onClick={(e) => { e.stopPropagation(); add(d.id); }} aria-label={`${t("add")}: ${dishName(d)}`}>+</button>)}
                </div>
              </article>
            ); })}
          </section>
        ))}
        <p className="g-foot">{t("menuBy")} <a href="/">mnu.digital</a></p>
      </main>

      {count > 0 && !checkout && (
        <button className="g-bar" type="button" onClick={() => setCheckout(true)}><span>{count === 1 ? t("oneItem") : t("nItems", { n: count })}</span><b>{t("viewOrder")} · {money(total, venue.currency)}</b></button>
      )}

      {open && (
        <Sheet closeLabel={t("close")} onClose={() => setOpen(null)} label={dishName(open)}>
            {photoUrl(open.image_path) && <div className="g-hero-wrap"><img className="g-hero" src={photoUrl(open.image_path)!} alt="" />{open.image_ai && <i>{t("illustrationNote")}</i>}</div>}
            <div className="g-sheet-body">
              <h3>{dishName(open)}</h3><p>{dishDesc(open)}</p>
              {open.tags?.length > 0 && <div className="g-tags">{open.tags.map((x) => <span key={x}>{label(x)}</span>)}</div>}
              {canOrder ? <button className="g-cta" type="button" onClick={() => { add(open.id); setOpen(null); }}>{t("addToOrder")} · {money(open.price, venue.currency)}</button>
                : <button className="g-cta ghost" type="button" onClick={() => setOpen(null)}>{t("close")}</button>}
            </div>
        </Sheet>
      )}

      {checkout && (
        <Sheet closeLabel={t("close")} onClose={() => setCheckout(false)} label={t("yourOrder")}>
            <div className="g-sheet-body">
              <h3>{t("yourOrder")}</h3>
              <ul className="g-lines">{lines.map((l) => (
                <li key={l.dish.id}><span>{dishName(l.dish)}</span><div className="g-qty"><button type="button" onClick={() => add(l.dish.id, -1)} aria-label={t("removeOne")}>−</button><span>{l.q}</span><button type="button" onClick={() => add(l.dish.id)} aria-label={t("addOne")}>+</button></div><em>{money(l.q * Number(l.dish.price), venue.currency)}</em></li>
              ))}</ul>
              {venue.dinein && venue.takeaway && (
                <div className="g-seg"><button type="button" aria-pressed={type === "dinein"} onClick={() => setType("dinein")}>{t("atTable")}</button><button type="button" aria-pressed={type === "takeaway"} onClick={() => setType("takeaway")}>{t("takeaway")}</button></div>
              )}
              {type === "dinein"
                ? (table
                  ? <div className="g-fixed"><span>{t("yourTable")}</span><b>{tableText(table)}</b></div>
                  : <label className="g-field">{t("tableNumber")}<input value={tableNo.replace(/^Table /, "")} onChange={(e) => setTableNo(e.target.value)} inputMode="numeric" placeholder={t("tableExample")} /></label>)
                : <label className="g-field">{t("nameForOrder")}<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>}
              {venue.notes && <label className="g-field">{t("noteLabel")}<input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} /></label>}
              {err && <p className="g-err">{err}</p>}
              <button className="g-cta" type="button" disabled={busy || !lines.length} onClick={place}>{busy ? t("sending") : `${t("placeOrder")} · ${money(total, venue.currency)}`}</button>
            </div>
        </Sheet>
      )}

      {placed !== null && (
        <Sheet closeLabel={t("close")} onClose={() => setPlaced(null)} label={t("orderSent")} className="g-done">
            <div className="g-sheet-body"><span className="g-check">✓</span><h3>{t("orderNSent", { n: placed })}</h3><p>{t("sentBody")}</p><button className="g-cta" type="button" onClick={() => { setPlaced(null); setShowMine(true); }}>{t("trackOrder")}</button><button className="g-cta ghost" type="button" onClick={() => setPlaced(null)}>{t("backToMenu")}</button></div>
        </Sheet>
      )}
      {showMine && (
        <Sheet closeLabel={t("close")} onClose={() => setShowMine(false)} label={t("myOrders")}>
            <div className="g-sheet-body">
              <h3>{t("myOrders")}</h3>
              <p>{t("mineIntro")}</p>
              {mine.map((o) => {
                const l = o.token ? live[o.token] : undefined;
                const known = l ? GUEST_STATUS[l.status] : undefined;
                const st = l ? (known ? [t(known[0]), known[1]] : [l.status, "st-new"]) : null;
                const items = l?.items?.length ? l.items : o.items;
                return (
                  <div className="g-order" key={`${o.number}-${o.at}`}>
                    <div className="g-order-top"><b>{t("orderN", { n: o.number })}</b>{st ? <span className={`g-pill ${st[1]}`}>{st[0]}</span> : <span className="g-pill st-new">{o.token ? t("checking") : t("sent")}</span>}</div>
                    <small>{tableText(o.label).replace(/^Takeaway/, t("takeaway"))} · {new Date(o.at).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</small>
                    <ul>{items.map((it, i) => <li key={i}><span>{it.qty}× {it.name}</span><em>{money(it.qty * Number(it.price), venue.currency)}</em></li>)}</ul>
                    <div className="g-order-total"><span>{t("total")}</span><b>{money(l?.total ?? o.total, venue.currency)}</b></div>
                  </div>
                );
              })}
              <button className="g-cta ghost" type="button" onClick={() => setShowMine(false)}>{t("backToMenu")}</button>
            </div>
        </Sheet>
      )}
      {pickLang && (
        <Sheet closeLabel={t("close")} onClose={() => setPickLang(false)} label={t("language")}>
          <div className="g-sheet-body">
            <h3>{t("language")}</h3>
            <div className="g-langs">{i18n.langs.map((l) => (
              <button key={l} type="button" aria-pressed={l === lang} onClick={() => chooseLang(l)} lang={l} dir={isRtl(l) ? "rtl" : "ltr"}>
                <b>{language(l).native}</b>{language(l).native !== language(l).name && <span>{language(l).name}</span>}
              </button>
            ))}</div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
