"use client";
import "@/styles/guest.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { money, photoUrl } from "@/lib/format";
import type { Category, Dish, Venue } from "@/lib/types";

type Props = { venue: Venue; categories: Category[]; dishes: Dish[]; table: string | null };
type Saved = { token: string | null; number: number; at: string; total: number; label: string; items: { name: string; qty: number; price: number }[] };
type Live = { token: string; status: string; total: number; items: { name: string; qty: number; price: number }[] };

const GUEST_STATUS: Record<string, [string, string]> = {
  new: ["Sent to the kitchen", "st-new"],
  preparing: ["Being prepared", "st-preparing"],
  ready: ["Ready", "st-ready"],
  done: ["Served", "st-done"],
  cancelled: ["Declined by the venue", "st-cancelled"],
};

export default function GuestMenu({ venue, categories, dishes, table }: Props) {
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
    const g = categories.map((c) => ({ id: c.id, name: c.name, items: dishes.filter((d) => d.category_id === c.id) })).filter((g) => g.items.length);
    const loose = dishes.filter((d) => !d.category_id || !categories.some((c) => c.id === d.category_id));
    if (loose.length) g.push({ id: "other", name: "More", items: loose });
    return g;
  }, [categories, dishes]);

  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ dish: dishes.find((d) => d.id === id)!, q })).filter((l) => l.dish);
  const count = lines.reduce((t, l) => t + l.q, 0);
  const total = lines.reduce((t, l) => t + l.q * Number(l.dish.price), 0);
  const canOrder = venue.ordering_on && (venue.dinein || venue.takeaway);
  const add = (id: string, n = 1) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + n) }));

  async function place() {
    setErr("");
    if (type === "dinein" && !tableNo.trim()) return setErr("Enter your table number.");
    if (type === "takeaway" && !name.trim()) return setErr("Enter a name for the order.");
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
    <div className="g" style={{ ["--brand" as string]: venue.brand }}>
      <header className="g-head">
        {photoUrl(venue.logo_path) && <img className="g-logo" src={photoUrl(venue.logo_path)!} alt={`${venue.name} logo`} />}
        <small>{venue.type.toUpperCase()}</small>
        <h1>{venue.name}</h1>
        {table && <span className="g-table">{table}</span>}
        {mine.length > 0 && <button type="button" className="g-mine" onClick={() => setShowMine(true)}>My orders · {mine.length}</button>}
      </header>
      <nav className="g-cats" aria-label="Categories">{groups.map((g) => <a key={g.id} href={`#c-${g.id}`}>{g.name}</a>)}</nav>

      <main className="g-list">
        {groups.length === 0 && <p className="g-empty">The menu is being prepared. Check back soon.</p>}
        {groups.map((g) => (
          <section key={g.id} id={`c-${g.id}`}>
            <h2>{g.name}</h2>
            {g.items.map((d) => { const src = photoUrl(d.image_path); return (
              <article className={`g-item${src ? "" : " noimg"}`} key={d.id} onClick={() => setOpen(d)}>
                {src && <span className="g-img">{<img src={src} alt="" />}{d.image_ai && <i>Illustration</i>}</span>}
                <div className="g-info"><b>{d.name}</b><p>{d.description}</p>{d.tags?.length > 0 && <div className="g-tags">{d.tags.map((t) => <span key={t}>{t}</span>)}</div>}</div>
                <div className="g-side"><em>{money(d.price, venue.currency)}</em>
                  {canOrder && (cart[d.id] ? (
                    <div className="g-qty" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => add(d.id, -1)} aria-label={`Remove one ${d.name}`}>−</button><span>{cart[d.id]}</span><button type="button" onClick={() => add(d.id)} aria-label={`Add one ${d.name}`}>+</button></div>
                  ) : <button className="g-add" type="button" onClick={(e) => { e.stopPropagation(); add(d.id); }} aria-label={`Add ${d.name}`}>+</button>)}
                </div>
              </article>
            ); })}
          </section>
        ))}
        <p className="g-foot">Menu by <a href="/">mnu.digital</a></p>
      </main>

      {count > 0 && !checkout && (
        <button className="g-bar" type="button" onClick={() => setCheckout(true)}><span>{count} item{count > 1 ? "s" : ""}</span><b>View order · {money(total, venue.currency)}</b></button>
      )}

      {open && (
        <div className="g-sheet-wrap" onClick={() => setOpen(null)}>
          <div className="g-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={open.name}>
            {photoUrl(open.image_path) && <div className="g-hero-wrap"><img className="g-hero" src={photoUrl(open.image_path)!} alt="" />{open.image_ai && <i>Illustration · actual dish may look different</i>}</div>}
            <div className="g-sheet-body">
              <h3>{open.name}</h3><p>{open.description}</p>
              {open.tags?.length > 0 && <div className="g-tags">{open.tags.map((t) => <span key={t}>{t}</span>)}</div>}
              {canOrder ? <button className="g-cta" type="button" onClick={() => { add(open.id); setOpen(null); }}>Add to order · {money(open.price, venue.currency)}</button>
                : <button className="g-cta ghost" type="button" onClick={() => setOpen(null)}>Close</button>}
            </div>
          </div>
        </div>
      )}

      {checkout && (
        <div className="g-sheet-wrap" onClick={() => setCheckout(false)}>
          <div className="g-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your order">
            <div className="g-sheet-body">
              <h3>Your order</h3>
              <ul className="g-lines">{lines.map((l) => (
                <li key={l.dish.id}><span>{l.dish.name}</span><div className="g-qty"><button type="button" onClick={() => add(l.dish.id, -1)} aria-label="Remove one">−</button><span>{l.q}</span><button type="button" onClick={() => add(l.dish.id)} aria-label="Add one">+</button></div><em>{money(l.q * Number(l.dish.price), venue.currency)}</em></li>
              ))}</ul>
              {venue.dinein && venue.takeaway && (
                <div className="g-seg"><button type="button" aria-pressed={type === "dinein"} onClick={() => setType("dinein")}>At the table</button><button type="button" aria-pressed={type === "takeaway"} onClick={() => setType("takeaway")}>Takeaway</button></div>
              )}
              {type === "dinein"
                ? (table
                  ? <div className="g-fixed"><span>Your table</span><b>{table}</b></div>
                  : <label className="g-field">Table number<input value={tableNo.replace(/^Table /, "")} onChange={(e) => setTableNo(e.target.value)} inputMode="numeric" placeholder="e.g. 7" /></label>)
                : <label className="g-field">Name for the order<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>}
              {venue.notes && <label className="g-field">Note for the kitchen (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Allergies, no onions…" /></label>}
              {err && <p className="g-err">{err}</p>}
              <button className="g-cta" type="button" disabled={busy || !lines.length} onClick={place}>{busy ? "Sending…" : `Place order · ${money(total, venue.currency)}`}</button>
            </div>
          </div>
        </div>
      )}

      {placed !== null && (
        <div className="g-sheet-wrap" onClick={() => setPlaced(null)}>
          <div className="g-sheet g-done" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Order sent">
            <div className="g-sheet-body"><span className="g-check">✓</span><h3>Order #{placed} sent</h3><p>The kitchen has your order. We’ll bring it over as soon as it’s ready.</p><button className="g-cta" type="button" onClick={() => { setPlaced(null); setShowMine(true); }}>Track my order</button><button className="g-cta ghost" type="button" onClick={() => setPlaced(null)}>Back to the menu</button></div>
          </div>
        </div>
      )}
      {showMine && (
        <div className="g-sheet-wrap" onClick={() => setShowMine(false)}>
          <div className="g-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="My orders">
            <div className="g-sheet-body">
              <h3>My orders</h3>
              <p>Orders from this phone in the last 24 hours. Status updates automatically.</p>
              {mine.map((o) => {
                const l = o.token ? live[o.token] : undefined;
                const st = l ? GUEST_STATUS[l.status] ?? [l.status, "st-new"] : null;
                const items = l?.items?.length ? l.items : o.items;
                return (
                  <div className="g-order" key={`${o.number}-${o.at}`}>
                    <div className="g-order-top"><b>Order #{o.number}</b>{st ? <span className={`g-pill ${st[1]}`}>{st[0]}</span> : <span className="g-pill st-new">{o.token ? "Checking…" : "Sent"}</span>}</div>
                    <small>{o.label} · {new Date(o.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                    <ul>{items.map((it, i) => <li key={i}><span>{it.qty}× {it.name}</span><em>{money(it.qty * Number(it.price), venue.currency)}</em></li>)}</ul>
                    <div className="g-order-total"><span>Total</span><b>{money(l?.total ?? o.total, venue.currency)}</b></div>
                  </div>
                );
              })}
              <button className="g-cta ghost" type="button" onClick={() => setShowMine(false)}>Back to the menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
