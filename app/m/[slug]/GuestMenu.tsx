"use client";
import "@/styles/guest.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { supabaseBrowser } from "@/lib/supabase/client";
import Sheet from "./Sheet";
import TableScanner from "./TableScanner";
import AddressInput, { type PickedAddress } from "./AddressInput";
import LogoMark from "@/components/LogoMark";
import { dishPrice, money, photoUrl } from "@/lib/format";
import { CURRENCY_CODE, track } from "@/lib/marketing";
import { fill, tkey, type ContentMap, type UiKey, type UiStrings } from "@/lib/i18n";
import { isRtl, language } from "@/lib/languages";
import { look } from "@/lib/themes";
import type { Category, Dish, Venue } from "@/lib/types";

type I18n = { primary: string; langs: string[]; content: ContentMap; ui: Record<string, UiStrings> };
type Props = { venue: Venue; categories: Category[]; dishes: Dish[]; table: string | null; i18n: I18n; ownerView?: boolean; preview?: boolean; startLang?: string; inactive?: boolean };
type Saved = { token: string | null; number: number; at: string; total: number; label: string; items: { name: string; qty: number; price: number }[] };
type Live = { token: string; status: string; total: number; items: { name: string; qty: number; price: number }[] };

const GUEST_STATUS: Record<string, [UiKey, string]> = {
  new: ["st_new", "st-new"],
  preparing: ["st_preparing", "st-preparing"],
  ready: ["st_ready", "st-ready"],
  done: ["st_done", "st-done"],
  cancelled: ["st_cancelled", "st-cancelled"],
};

// Design fields the dashboard's live preview may change while the owner edits them.
const PREVIEW_FIELDS = ["brand", "bg_color", "logo_layout", "theme", "font", "cover_path", "logo_path", "info"] as const;

export default function GuestMenu({ venue: savedVenue, categories: savedCats, dishes: savedDishes, table: initialTable, i18n, ownerView = false, preview = false, startLang, inactive = false }: Props) {
  const [venue, setVenue] = useState(savedVenue);
  // In the dashboard preview, dragging categories or dishes reorders this copy straight away.
  const [categories, setCategories] = useState(savedCats);
  const [dishes, setDishes] = useState(savedDishes);
  useEffect(() => { setCategories(savedCats); setDishes(savedDishes); }, [savedCats, savedDishes]);
  useEffect(() => {
    if (window.parent === window) return;
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "mnu:order") {
        const cats = e.data.cats as string[] | undefined, pos = new Map((e.data.dishes as { id: string; position: number }[] | undefined ?? []).map((x) => [x.id, x.position]));
        if (cats) setCategories((cs) => [...cs].sort((a, b) => cats.indexOf(a.id) - cats.indexOf(b.id)));
        if (pos.size) setDishes((ds) => ds.map((d) => (pos.has(d.id) ? { ...d, position: pos.get(d.id)! } : d)).sort((a, b) => a.position - b.position));
        return;
      }
      if (e.data?.type !== "mnu:design") return;
      const d = e.data.design as Partial<Venue>;
      setVenue((v) => ({ ...v, ...Object.fromEntries(PREVIEW_FIELDS.filter((k) => k in d).map((k) => [k, d[k]])) }));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const [table, setTable] = useState(initialTable);
  const [scanning, setScanning] = useState(false);
  const [lang, setLang] = useState(startLang ?? i18n.primary);
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
    if (startLang) return;
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
  const scanLabels = useMemo(() => ({ title: ui.scanTableBtn, help: ui.scanHelp, cameraError: ui.cameraError, wrong: ui.scanWrong, close: ui.close }), [ui]);
  const onTableScanned = useCallback((n: string) => {
    setTable(`Table ${n}`); setType("dinein"); setScanning(false); setErr("");
    // Keep the table if the page is reloaded.
    const u = new URL(window.location.href); u.searchParams.set("t", n); window.history.replaceState(null, "", u);
  }, []);
  // First field of the details step (focused when it opens).
  const nameInput = useRef<HTMLInputElement>(null);
  // Popup message from Settings → Marketing: after a short delay, once per guest or every visit.
  const popup = venue.marketing?.popup;
  const [showPopup, setShowPopup] = useState(false);
  const popupKey = `mnu.popup.${venue.slug}.${popup?.version ?? 0}`;
  useEffect(() => {
    if (!popup?.enabled || !(popup.title || popup.body || popup.image_path) || preview) return;
    try { if (popup.frequency === "once" && localStorage.getItem(popupKey)) return; } catch { /* storage unavailable */ }
    const t = setTimeout(() => setShowPopup(true), Math.min(30, Math.max(0, popup.delay ?? 2)) * 1000);
    return () => clearTimeout(t);
  }, [popup, popupKey, preview]);
  function closePopup() {
    setShowPopup(false);
    try { localStorage.setItem(popupKey, "1"); } catch { /* storage unavailable */ }
  }
  const currencyCode = CURRENCY_CODE[venue.currency] ?? "USD";
  const popupText = { title: tr("p:title")?.name || popup?.title || "", body: tr("p:body")?.name || popup?.body || "", cta: tr("p:cta")?.name || popup?.cta_label || "" };

  // Anonymous analytics for the owner: a menu view (once per 30 minutes per phone), dishes opened,
  // and a ping while the menu is open (for "viewing now"). Not in the dashboard preview.
  const counted = !preview && /^[0-9a-f-]{36}$/.test(venue.id);
  const visitor = useRef("");
  const seenDishes = useRef(new Set<string>());
  useEffect(() => {
    if (!counted) return;
    try {
      visitor.current = localStorage.getItem("mnu.vid") ?? "";
      if (!visitor.current) { visitor.current = crypto.randomUUID(); localStorage.setItem("mnu.vid", visitor.current); }
    } catch { visitor.current = crypto.randomUUID(); }
    const sb = supabaseBrowser();
    const lastKey = `mnu.viewed.${venue.id}`;
    let last = 0;
    try { last = Number(localStorage.getItem(lastKey) ?? 0); } catch { /* storage unavailable */ }
    if (Date.now() - last > 30 * 60000) {
      sb.rpc("log_menu_event", { p_venue: venue.id, p_kind: "view", p_dish: null, p_visitor: visitor.current, p_lang: lang }).then(() => {}, () => {});
      try { localStorage.setItem(lastKey, String(Date.now())); } catch { /* storage unavailable */ }
    }
    const ping = () => { if (!document.hidden) sb.rpc("menu_ping", { p_venue: venue.id, p_visitor: visitor.current }).then(() => {}, () => {}); };
    ping();
    const t = setInterval(ping, 25000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, [counted, venue.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openDish(d: Dish) {
    if (counted && visitor.current && !seenDishes.current.has(d.id)) {
      seenDishes.current.add(d.id);
      supabaseBrowser().rpc("log_menu_event", { p_venue: venue.id, p_kind: "dish", p_dish: d.id, p_visitor: visitor.current, p_lang: lang }).then(() => {}, () => {});
    }
    track("ViewContent", { name: d.name, value: dishPrice(d)?.amount, currency: currencyCode });
    const first = (d.options ?? []).find((o) => (o.price ?? d.price) !== null);
    setVariant(first?.name ?? null);
    setOpen(d);
  }
  function chooseLang(l: string) {
    setLang(l); setPickLang(false);
    try { localStorage.setItem(langKey, l); } catch { /* storage unavailable */ }
  }
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Dish | null>(null);
  const [checkout, setCheckout] = useState(false);
  // At the table comes first. The table number itself only comes from the QR code on it.
  const [type, setType] = useState<"dinein" | "takeaway" | "delivery">(venue.dinein ? "dinein" : venue.takeaway ? "takeaway" : venue.delivery ? "delivery" : "dinein");
  // Checkout is two steps when it needs the guest's details: the order, then name / phone / address.
  const [step, setStep] = useState<"order" | "details">("order");
  const [moreOpen, setMoreOpen] = useState(false);
  const [bad, setBad] = useState<"name" | "phone" | "address" | null>(null);
  const fixed = (k: typeof bad) => { if (bad === k) { setBad(null); setErr(""); } };
  const [noteOpen, setNoteOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  // Phone (Settings → Ordering) and, for delivery, where to bring it.
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState<PickedAddress | null>(null);
  const [extra, setExtra] = useState({ apt: "", floor: "", building: "", code: "", instructions: "" });
  const [dropoff, setDropoff] = useState<"door" | "hand" | "call">("hand");
  const askPhone = type === "delivery" ? "required" : venue.ask_phone ?? "off";
  // Details from this guest's last order on this phone, so they don't type them again.
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem("mnu.guest") ?? "null");
      if (!g) return;
      if (g.name) setName(g.name);
      if (g.phone) setPhone(g.phone);
      if (g.addr?.address) { setAddr(g.addr); setExtra((x) => ({ ...x, ...g.extra })); if (g.dropoff) setDropoff(g.dropoff); }
    } catch { /* storage unavailable */ }
  }, []);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [mine, setMine] = useState<Saved[]>([]);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [showMine, setShowMine] = useState(false);
  const storeKey = `mnu.orders.${venue.slug}`;

  // An order the guest started but didn't send is kept on the phone for 12 hours as a draft.
  const draftKey = `mnu.cart.${venue.slug}`;
  const draftLoaded = useRef(false);
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { cart: Record<string, number>; name?: string; note?: string; at: number } | null;
      if (d && Date.now() - d.at < 12 * 3600000) {
        const kept = Object.fromEntries(Object.entries(d.cart).filter(([key, q]) => q > 0 && dishes.some((x) => x.id === key.split("::")[0])));
        if (Object.keys(kept).length) { setCart(kept); if (d.name) setName(d.name); if (d.note) setNote(d.note); }
      }
    } catch { /* storage unavailable */ }
    draftLoaded.current = true;
  }, [draftKey, dishes]);

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

  // Business details in the header (Settings → General → On your menu), and dish search.
  const info = venue.info ?? {};
  const showInfo = (k: "phone" | "address" | "hours" | "wifi" | "about") => !(info.hide ?? []).includes(k) && !!(k === "wifi" ? info.wifi_name || info.wifi_password : info[k]?.trim());
  const [infoOpen, setInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchOn = info.search !== false;
  const [query, setQuery] = useState("");
  // Search opens from the magnifier in the header, with the keyboard up right away (focusing inside
  // the tap, after rendering the field synchronously, is what lets iOS open it).
  const [searching, setSearching] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  function openSearch() {
    flushSync(() => setSearching(true));
    searchInput.current?.focus();
  }
  function closeSearch() { setQuery(""); setSearching(false); }

  const groups = useMemo(() => {
    const g = categories.map((c) => ({ id: c.id, name: (lang !== i18n.primary && i18n.content[lang]?.[tkey.cat(c.id)]?.name) || c.name, items: dishes.filter((d) => d.category_id === c.id) })).filter((g) => g.items.length);
    const loose = dishes.filter((d) => !d.category_id || !categories.some((c) => c.id === d.category_id));
    if (loose.length) g.push({ id: "other", name: ui.more, items: loose });
    return g;
  }, [categories, dishes, lang, i18n, ui]);
  // While searching, one list of the dishes whose name or description (in any language shown) matches.
  const fold = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05C7]/g, "");
  const q = fold(query.trim());
  const shown = q ? [{ id: "search", name: t("results"), items: groups.flatMap((g) => g.items).filter((d) => fold(`${dishName(d)} ${dishDesc(d)} ${d.name} ${d.description ?? ""}`).includes(q)) }] : groups;

  // The category bar follows the scroll: the section in view is highlighted and kept visible in the bar.
  const catsNav = useRef<HTMLElement>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const jumping = useRef(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      // While a sheet is open the page is pinned in place (see Sheet), which makes it look scrolled to the end.
      if (jumping.current || document.body.style.position === "fixed") return;
      const line = (catsNav.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let current: string | null = groups[0]?.id ?? null;
      for (const g of groups) {
        const el = document.getElementById(`c-${g.id}`);
        if (el && el.getBoundingClientRect().top <= line) current = g.id;
      }
      // At the very bottom the last section counts as current even if it is short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = groups[groups.length - 1]?.id ?? current;
      setActiveCat(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [groups]);
  useEffect(() => {
    const nav = catsNav.current;
    const chip = nav?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    if (!nav || !chip) return;
    const n = nav.getBoundingClientRect(), c = chip.getBoundingClientRect();
    // Clamp to the real scroll range (negative in right-to-left), or iOS can stop part-way past the edge.
    const room = nav.scrollWidth - nav.clientWidth;
    const [min, max] = getComputedStyle(nav).direction === "rtl" ? [-room, 0] : [0, room];
    const left = Math.min(max, Math.max(min, nav.scrollLeft + c.left + c.width / 2 - (n.left + n.width / 2)));
    if (Math.abs(left - nav.scrollLeft) > 1) nav.scrollTo({ left, behavior: "smooth" });
  }, [activeCat]);
  function jumpTo(id: string) {
    const el = document.getElementById(`c-${id}`);
    if (!el) return;
    setActiveCat(id);
    jumping.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - (catsNav.current?.offsetHeight ?? 0) - 8;
    window.scrollTo({ top, behavior: "smooth" });
    setTimeout(() => { jumping.current = false; }, 700);
  }

  useEffect(() => {
    if (!draftLoaded.current) return;
    try {
      if (Object.values(cart).some((q) => q > 0)) localStorage.setItem(draftKey, JSON.stringify({ cart, name, note, at: Date.now() }));
      else localStorage.removeItem(draftKey);
    } catch { /* storage unavailable */ }
  }, [cart, name, note, draftKey]);

  // Cart keys are a dish id, or "dishId::variation" for a dish ordered as one of its variations.
  const opts = (d: Dish) => d.options ?? [];
  const unitPrice = (d: Dish, v: string | null) => (v ? opts(d).find((o) => o.name === v)?.price ?? d.price : d.price);
  const variantName = (d: Dish, v: string) => tr(tkey.variant(d.id, v))?.name || v;
  const lineName = (d: Dish, v: string | null) => (v ? `${dishName(d)} · ${variantName(d, v)}` : dishName(d));
  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([key, q]) => {
    const [id, v = null] = key.split("::");
    const dish = dishes.find((d) => d.id === id)!;
    return { key, dish, variant: v, q, price: dish ? unitPrice(dish, v) : null };
  }).filter((l): l is typeof l & { price: number } => !!l.dish && l.price !== null && l.price !== undefined && (l.variant ? opts(l.dish).some((o) => o.name === l.variant) : !opts(l.dish).length));
  const count = lines.reduce((t, l) => t + l.q, 0);
  const total = lines.reduce((t, l) => t + l.q * Number(l.price), 0);
  const priceText = (d: Dish) => { const p = dishPrice(d); return p ? (p.from ? t("fromPrice", { p: money(p.amount, venue.currency) }) : money(p.amount, venue.currency)) : null; };
  const [variant, setVariant] = useState<string | null>(null);
  const canOrder = venue.ordering_on && (venue.dinein || venue.takeaway || !!venue.delivery);
  const orderTypes = (["dinein", "takeaway", "delivery"] as const).filter((k) => (k === "delivery" ? !!venue.delivery : venue[k]));
  // If the owner turns an order type off, fall back to one that's on.
  useEffect(() => { if (orderTypes.length && !orderTypes.includes(type)) setType(orderTypes[0]); }, [orderTypes.join(), type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (checkout) { setStep("order"); setErr(""); } }, [checkout]);
  const needsDetails = type !== "dinein" || askPhone !== "off";
  function goDetails() {
    setErr(""); setBad(null);
    if (type === "dinein" && !table) return setErr(t("scanTable"));
    // Rendering the next step inside the tap is what lets iOS open the keyboard on its first field.
    flushSync(() => setStep("details"));
    nameInput.current?.focus();
  }
  const add = (id: string, n = 1) => {
    if (n > 0) { const d = dishes.find((x) => x.id === id.split("::")[0]); if (d) track("AddToCart", { name: d.name, value: Number(unitPrice(d, id.split("::")[1] ?? null) ?? 0) * n, currency: currencyCode }); }
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + n) }));
  };

  async function place() {
    setErr("");
    if (type === "dinein" && !table) return setErr(t("scanTable"));
    // The first missing field gets a red frame and the focus.
    const missing = type !== "dinein" && !name.trim() ? "name" : askPhone === "required" && phone.replace(/\D/g, "").length < 6 ? "phone" : type === "delivery" && !addr?.address ? "address" : null;
    setBad(missing);
    if (missing) {
      document.getElementById(`g-in-${missing}`)?.focus();
      return setErr(t(missing === "name" ? "errName" : missing === "phone" ? "errPhone" : "errAddress"));
    }
    setBusy(true);
    const label = type === "dinein" ? table! : type === "delivery" ? "Delivery" : "Takeaway";
    const args = {
      p_slug: venue.slug, p_table: label, p_type: type, p_name: name.trim() || null, p_note: note.trim() || null,
      p_items: lines.map((l) => ({ dish_id: l.dish.id, qty: l.q, ...(l.variant ? { variant: l.variant } : {}) })),
    };
    const sb = supabaseBrowser();
    let number: number | null = null;
    let token: string | null = null;
    const delivery = type === "delivery" && addr ? { ...addr, ...extra, dropoff } : null;
    const v3 = await sb.rpc("place_order_v3", { ...args, p_phone: askPhone !== "off" ? phone.trim() || null : null, p_delivery: delivery });
    const v2 = v3.error?.code === "PGRST202" && type !== "delivery" ? await sb.rpc("place_order_v2", args) : v3;
    if (!v2.error) { number = (v2.data as { number: number; token: string }).number; token = (v2.data as { number: number; token: string }).token; }
    else if (v2.error.code === "PGRST202") {
      // Tracking isn't set up in the database yet: place the order the old way.
      const v1 = await sb.rpc("place_order", args);
      if (v1.error) { setBusy(false); return setErr(v1.error.message.replace(/^.*?: /, "")); }
      number = v1.data as number;
    } else { setBusy(false); return setErr(v2.error.message.replace(/^.*?: /, "")); }
    setBusy(false);
    const saved: Saved = { token, number: number!, at: new Date().toISOString(), total, label: type === "dinein" ? label : type === "delivery" ? `Delivery · ${addr?.address ?? ""}` : `Takeaway · ${name.trim()}`, items: lines.map((l) => ({ name: l.variant ? `${l.dish.name} (${l.variant})` : l.dish.name, qty: l.q, price: Number(l.price) })) };
    const next = [saved, ...mine].slice(0, 20);
    setMine(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
    try { localStorage.setItem("mnu.guest", JSON.stringify({ name: name.trim(), phone: phone.trim(), ...(type === "delivery" ? { addr, extra, dropoff } : {}) })); } catch { /* storage unavailable */ }
    track("Purchase", { value: total, currency: currencyCode });
    setPlaced(number); setCart({}); setCheckout(false);
  }

  return (
    <div className={`g ${design.className}`} lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <style>{design.css}</style>
      {design.fonts && <link rel="stylesheet" href={design.fonts} precedence="default" />}
      {ownerView && inactive && <div className="g-private">No active subscription · only you can see this menu, and ordering is off. Guests see it as unavailable until you subscribe in your dashboard.</div>}
      {ownerView && venue.is_public === false && <div className="g-private">Private menu · only you can see it. Guests see a “private” notice until you make it public in Settings → General.</div>}
      <header className={`g-head${cover ? " has-cover" : ""}`} style={cover ? { ["--cover" as string]: `url("${cover}")` } : undefined}>
        {photoUrl(venue.logo_path) && <LogoMark className="g-logo" src={photoUrl(venue.logo_path)!} alt={`${venue.name} logo`} layout={venue.logo_layout} />}
        <small>{(ui[`type_${venue.type.replace(/\s+/g, "")}` as UiKey] ?? venue.type).toUpperCase()}</small>
        <h1>{venue.name}</h1>
        {showInfo("about") && <button type="button" className="g-about" onClick={() => setInfoOpen(true)}>{info.about}</button>}
        {(showInfo("phone") || showInfo("address") || showInfo("hours") || showInfo("wifi")) && (
          <div className="g-info-row">
            {showInfo("phone") && <a className="g-chip" href={`tel:${info.phone!.replace(/[^\d+]/g, "")}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>{t("call")}</a>}
            {showInfo("address") && <a className="g-chip" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address!)}`} target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>{t("directions")}</a>}
            {showInfo("hours") && <button type="button" className="g-chip" onClick={() => setInfoOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{t("hours")}</button>}
            {showInfo("wifi") && <button type="button" className="g-chip" onClick={() => setInfoOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" /></svg>{t("wifi")}</button>}
          </div>
        )}
        {table && <span className="g-table">{tableText(table)}</span>}
        <div className="g-top">
          {searchOn && <button type="button" className="g-lang g-search-btn" onClick={() => (searching ? closeSearch() : openSearch())} aria-label={t("searchDishes")} aria-expanded={searching} title={t("searchDishes")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          </button>}
          {(mine.length > 0 || count > 0) && <button type="button" className="g-mine" onClick={() => setShowMine(true)}>{t("myOrders")}<b>{mine.length + (count > 0 ? 1 : 0)}</b></button>}
          {i18n.langs.length > 1 && (
            <button type="button" className="g-lang" onClick={() => setPickLang(true)} aria-label={`${t("language")}: ${language(lang).native}`} title={language(lang).native}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
            </button>
          )}
        </div>
      </header>
      {searchOn && searching && (
        <div className="g-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input ref={searchInput} type="search" value={query} onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchDishes")} aria-label={t("searchDishes")} enterKeyHint="search" />
          <button type="button" onClick={closeSearch} aria-label={t("close")}>×</button>
        </div>
      )}
      <nav className="g-cats" ref={catsNav} aria-label={t("menu")} hidden={!!q || searching}>{groups.map((g) => (
        <a key={g.id} href={`#c-${g.id}`} data-cat={g.id} className={activeCat === g.id ? "on" : undefined} aria-current={activeCat === g.id ? "true" : undefined}
          onClick={(e) => { e.preventDefault(); jumpTo(g.id); }}>{g.name}</a>
      ))}</nav>

      <main className="g-list">
        {groups.length === 0 && <p className="g-empty">{t("empty")}</p>}
        {q && !shown[0].items.length && <p className="g-empty">{t("noResults", { q: query.trim() })}</p>}
        {shown.filter((g) => g.items.length).map((g) => (
          <section key={g.id} id={`c-${g.id}`}>
            <h2>{g.name}</h2>
            {g.items.map((d) => { const src = photoUrl(d.image_path); return (
              <article className={`g-item${src ? "" : " noimg"}`} key={d.id} onClick={() => openDish(d)}>
                {src && <span className="g-img">{<img src={src} alt="" />}{d.image_ai && <i>{t("illustration")}</i>}</span>}
                <div className="g-info"><b>{dishName(d)}</b><p>{dishDesc(d)}</p>{d.tags?.length > 0 && <div className="g-tags">{d.tags.map((x) => <span key={x}>{label(x)}</span>)}</div>}</div>
                <div className="g-side">{priceText(d) && <em>{priceText(d)}</em>}
                  {canOrder && dishPrice(d) && (opts(d).length ? (
                    <button className="g-add" type="button" onClick={(e) => { e.stopPropagation(); openDish(d); }} aria-label={`${t("add")}: ${dishName(d)}`}>+</button>
                  ) : cart[d.id] ? (
                    <div className="g-qty" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => add(d.id, -1)} aria-label={`${t("removeOne")}: ${dishName(d)}`}>−</button><span>{cart[d.id]}</span><button type="button" onClick={() => add(d.id)} aria-label={`${t("addOne")}: ${dishName(d)}`}>+</button></div>
                  ) : <button className="g-add" type="button" onClick={(e) => { e.stopPropagation(); add(d.id); }} aria-label={`${t("add")}: ${dishName(d)}`}>+</button>)}
                </div>
              </article>
            ); })}
          </section>
        ))}
        <p className="g-foot">{t("menuBy")} <a href="/">mnu.digital</a></p>
      </main>

      {count > 0 && !checkout && canOrder && (
        <button className="g-bar" type="button" onClick={() => setCheckout(true)}><span>{count === 1 ? t("oneItem") : t("nItems", { n: count })}</span><b>{t("viewOrder")} · {money(total, venue.currency)}</b></button>
      )}

      {open && (
        <Sheet closeLabel={t("close")} onClose={() => setOpen(null)} label={dishName(open)}>
            {photoUrl(open.image_path) && <div className="g-hero-wrap"><img className="g-hero" src={photoUrl(open.image_path)!} alt="" />{open.image_ai && <i>{t("illustrationNote")}</i>}</div>}
            <div className="g-sheet-body">
              <h3>{dishName(open)}</h3><p>{dishDesc(open)}</p>
              {open.tags?.length > 0 && <div className="g-tags">{open.tags.map((x) => <span key={x}>{label(x)}</span>)}</div>}
              {opts(open).length > 0 && (
                <div className="g-variants" role="radiogroup" aria-label={t("chooseOption")}>
                  <b>{t("chooseOption")}</b>
                  {opts(open).map((o) => { const p = unitPrice(open, o.name); return (
                    <button key={o.name} type="button" role="radio" aria-checked={variant === o.name} disabled={p === null} onClick={() => setVariant(o.name)}>
                      <i aria-hidden="true" /><span>{variantName(open, o.name)}</span>{p !== null && <em>{money(p, venue.currency)}</em>}
                    </button>
                  ); })}
                </div>
              )}
              {(() => {
                const v = opts(open).length ? variant : null;
                const p = opts(open).length && !v ? null : unitPrice(open, v);
                if (!canOrder || !dishPrice(open)) return <button className="g-cta ghost" type="button" onClick={() => setOpen(null)}>{t("close")}</button>;
                return <button className="g-cta" type="button" disabled={p === null} onClick={() => { add(v ? `${open.id}::${v}` : open.id); setOpen(null); }}>{t("addToOrder")}{p !== null ? ` · ${money(p, venue.currency)}` : ""}</button>;
              })()}
            </div>
        </Sheet>
      )}

      {checkout && canOrder && (
        <Sheet closeLabel={t("close")} onClose={() => setCheckout(false)} label={t("yourOrder")} className="g-light">
          {step === "order" ? (
            <div className="g-sheet-body">
              <h3>{t("yourOrder")}</h3>
              <ul className="g-lines">{lines.map((l) => (
                <li key={l.key}><span>{lineName(l.dish, l.variant)}</span><div className="g-qty"><button type="button" onClick={() => add(l.key, -1)} aria-label={t("removeOne")}>−</button><span>{l.q}</span><button type="button" onClick={() => add(l.key)} aria-label={t("addOne")}>+</button></div><em>{money(l.q * l.price, venue.currency)}</em></li>
              ))}</ul>
              {venue.notes && (noteOpen || note
                ? <label className="g-field g-note">{t("noteLabel")}
                    <span className="g-note-wrap">
                      {/* Left empty, the note closes again once they tap elsewhere. */}
                      <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (!note.trim()) { setNote(""); setNoteOpen(false); } }} placeholder={t("notePlaceholder")} autoFocus={!note} />
                      <button type="button" className="g-note-x" onMouseDown={(e) => e.preventDefault()} onClick={() => { setNote(""); setNoteOpen(false); }} aria-label={t("close")}>×</button>
                    </span>
                  </label>
                : <button type="button" className="g-note-add" onClick={() => setNoteOpen(true)}>+ {t("addNote")}</button>)}
              {orderTypes.length > 1 && (
                <div className="g-seg">
                  {venue.dinein && <button type="button" aria-pressed={type === "dinein"} onClick={() => { setType("dinein"); setErr(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18M5 9v11M19 9v11M7 9l2-5h6l2 5M9 15h6" /></svg>{t("atTable")}</button>}
                  {venue.takeaway && <button type="button" aria-pressed={type === "takeaway"} onClick={() => { setType("takeaway"); setErr(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" /><path d="M9 11V6a3 3 0 0 1 6 0v5" /></svg>{t("takeaway")}</button>}
                  {venue.delivery && <button type="button" aria-pressed={type === "delivery"} onClick={() => { setType("delivery"); setErr(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>{t("delivery")}</button>}
                </div>
              )}
              {type === "dinein" && (table
                ? <div className="g-fixed"><span>{t("yourTable")}</span><b>{tableText(table)}</b></div>
                : <div className="g-hint"><p>{t("scanTable")}</p><button type="button" className="g-scan-btn" onClick={() => setScanning(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></svg>{t("scanTableBtn")}</button></div>)}
              {err && <p className="g-err">{err}</p>}
              <button className="g-cta g-sticky" type="button" disabled={busy || !lines.length || (type === "dinein" && !table)} onClick={needsDetails ? goDetails : place}>
                {busy ? t("sending") : `${needsDetails ? t("continue") : t("placeOrder")} · ${money(total, venue.currency)}`}
              </button>
            </div>
          ) : (
            <div className="g-sheet-body">
              <div className="g-step-head">
                <button type="button" className="g-back" onClick={() => { setStep("order"); setErr(""); }} aria-label={t("yourOrder")}>‹</button>
                <div><small>{t("stepOf", { n: 2 })}</small><h3>{type === "delivery" ? t("deliveryDetails") : t("yourDetails")}</h3></div>
              </div>
              <div className="g-progress" aria-hidden="true"><i /><i /></div>
              {type !== "dinein" && <label className={`g-field${bad === "name" ? " g-bad" : ""}`}>{t("nameForOrder")}<input id="g-in-name" ref={nameInput} value={name} onChange={(e) => { setName(e.target.value); fixed("name"); }} autoComplete="name" aria-invalid={bad === "name"} /></label>}
              {askPhone !== "off" && <label className={`g-field${bad === "phone" ? " g-bad" : ""}`}>{askPhone === "required" ? t("phone") : t("phoneOptional")}<input id="g-in-phone" aria-invalid={bad === "phone"} ref={type === "dinein" ? nameInput : undefined} type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); fixed("phone"); }} autoComplete="tel" inputMode="tel" dir="ltr" /></label>}
              {type === "delivery" && (
                <div className="g-delivery">
                  <AddressInput invalid={bad === "address"} value={addr} onChange={(v) => { setAddr(v); if (v) fixed("address"); }} label={t("address")} placeholder={t("addressPlaceholder")} lang={lang} />
                  <div className="g-row2">
                    <label className="g-field">{t("apt")}<input value={extra.apt} onChange={(e) => setExtra({ ...extra, apt: e.target.value })} autoComplete="address-line2" /></label>
                    <label className="g-field">{t("floor")}<input value={extra.floor} onChange={(e) => setExtra({ ...extra, floor: e.target.value })} inputMode="numeric" /></label>
                  </div>
                  <div className="g-field"><span>{t("dropoff")}</span>
                    <div className="g-chips">{(["hand", "door", "call"] as const).map((k) => <button key={k} type="button" aria-pressed={dropoff === k} onClick={() => setDropoff(k)}>{t(k === "hand" ? "dropHand" : k === "door" ? "dropDoor" : "dropCall")}</button>)}</div>
                  </div>
                  {moreOpen || extra.building || extra.code || extra.instructions ? (
                    <>
                      <div className="g-row2">
                        <label className="g-field">{t("building")}<input value={extra.building} onChange={(e) => setExtra({ ...extra, building: e.target.value })} /></label>
                        <label className="g-field">{t("gateCode")}<input value={extra.code} onChange={(e) => setExtra({ ...extra, code: e.target.value })} /></label>
                      </div>
                      <label className="g-field">{t("courierNote")}<input value={extra.instructions} onChange={(e) => setExtra({ ...extra, instructions: e.target.value })} placeholder={t("courierPlaceholder")} /></label>
                    </>
                  ) : <button type="button" className="g-note-add" onClick={() => setMoreOpen(true)}>+ {t("moreDelivery")}</button>}
                </div>
              )}
              {err && <p className="g-err">{err}</p>}
              <button className="g-cta g-sticky" type="button" disabled={busy || !lines.length} onClick={place}>{busy ? t("sending") : `${t("placeOrder")} · ${money(total, venue.currency)}`}</button>
            </div>
          )}
        </Sheet>
      )}

      {infoOpen && (
        <Sheet closeLabel={t("close")} onClose={() => { setInfoOpen(false); setCopied(false); }} label={t("info")} className="g-light">
          <div className="g-sheet-body g-infosheet">
            <h3>{venue.name}</h3>
            {showInfo("about") && <p className="g-info-about">{info.about}</p>}
            {showInfo("hours") && <div className="g-info-block"><b>{t("hours")}</b><p>{info.hours}</p></div>}
            {showInfo("wifi") && (
              <div className="g-info-block"><b>{t("wifi")}</b>
                {info.wifi_name && <p>{t("wifiNetwork")}: <span translate="no">{info.wifi_name}</span></p>}
                {info.wifi_password && <p className="g-wifi-pass">{t("wifiPassword")}: <code translate="no">{info.wifi_password}</code>
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(info.wifi_password!).then(() => setCopied(true)).catch(() => {}); }}>{copied ? `✓ ${t("copied")}` : t("copy")}</button></p>}
              </div>
            )}
            {showInfo("address") && <div className="g-info-block"><b>{t("directions")}</b><p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address!)}`} target="_blank" rel="noreferrer">{info.address}</a></p></div>}
            {showInfo("phone") && <a className="g-cta" href={`tel:${info.phone!.replace(/[^\d+]/g, "")}`}>{t("call")} · <span dir="ltr">{info.phone}</span></a>}
          </div>
        </Sheet>
      )}

      {placed !== null && (
        <Sheet closeLabel={t("close")} onClose={() => setPlaced(null)} label={t("orderSent")} className="g-done g-light">
            <div className="g-sheet-body"><span className="g-check">✓</span><h3>{t("orderNSent", { n: placed })}</h3><p>{t("sentBody")}</p><button className="g-cta" type="button" onClick={() => { setPlaced(null); setShowMine(true); }}>{t("trackOrder")}</button><button className="g-cta ghost" type="button" onClick={() => setPlaced(null)}>{t("backToMenu")}</button></div>
        </Sheet>
      )}
      {showMine && (
        <Sheet closeLabel={t("close")} onClose={() => setShowMine(false)} label={t("myOrders")} className="g-light">
            <div className="g-sheet-body">
              <h3>{t("myOrders")}</h3>
              {count > 0 && (
                <div className="g-order g-draft">
                  <div className="g-order-top"><b>{t("draft")}</b><span className="g-draft-tools"><span className="g-pill st-draft">{t("notSent")}</span>
                    <button type="button" className="g-trash" onClick={() => { setCart({}); setNote(""); if (!mine.length) setShowMine(false); }} aria-label={t("deleteDraft")} title={t("deleteDraft")}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                    </button></span></div>
                  <small>{t("draftIntro")}</small>
                  <ul>{lines.map((l) => <li key={l.key}><span>{l.q}× {lineName(l.dish, l.variant)}</span><em>{money(l.q * l.price, venue.currency)}</em></li>)}</ul>
                  <div className="g-order-total"><span>{t("total")}</span><b>{money(total, venue.currency)}</b></div>
                  <div className="g-draft-actions">
                    {canOrder && <button type="button" className="g-cta" onClick={() => { setShowMine(false); setCheckout(true); }}>{t("finishOrder")}</button>}
                  </div>
                </div>
              )}
              {mine.length > 0 && <p>{t("mineIntro")}</p>}
              {mine.map((o) => {
                const l = o.token ? live[o.token] : undefined;
                const known = l ? GUEST_STATUS[l.status] : undefined;
                const st = l ? (known ? [t(known[0]), known[1]] : [l.status, "st-new"]) : null;
                const items = l?.items?.length ? l.items : o.items;
                return (
                  <div className="g-order" key={`${o.number}-${o.at}`}>
                    <div className="g-order-top"><b>{t("orderN", { n: o.number })}</b>{st ? <span className={`g-pill ${st[1]}`}>{st[0]}</span> : <span className="g-pill st-new">{o.token ? t("checking") : t("sent")}</span>}</div>
                    <small>{tableText(o.label).replace(/^(Takeaway|Pickup)/, t("takeaway")).replace(/^Delivery/, t("delivery"))} · {new Date(o.at).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</small>
                    <ul>{items.map((it, i) => <li key={i}><span>{it.qty}× {it.name}</span><em>{money(it.qty * Number(it.price), venue.currency)}</em></li>)}</ul>
                    <div className="g-order-total"><span>{t("total")}</span><b>{money(l?.total ?? o.total, venue.currency)}</b></div>
                  </div>
                );
              })}
              <button className="g-cta ghost g-sticky" type="button" onClick={() => setShowMine(false)}>{t("backToMenu")}</button>
            </div>
        </Sheet>
      )}
      {scanning && (
        <TableScanner slug={venue.slug} labels={scanLabels} onClose={() => setScanning(false)} onFound={onTableScanned} />
      )}
      {showPopup && popup && (
        <div className="g-popup-wrap" role="dialog" aria-modal="true" aria-label={popupText.title || popupText.body || venue.name} onClick={closePopup}>
          <div className={`g-popup${popup.image_path ? " has-img" : ""}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="g-popup-x" onClick={closePopup} aria-label={t("close")}>×</button>
            {popup.image_path && <img className="g-popup-img" src={photoUrl(popup.image_path)!} alt="" />}
            {popupText.title && <h3>{popupText.title}</h3>}
            {popupText.body && <p>{popupText.body}</p>}
            {popup.cta_label && popup.cta_url
              ? <a className="g-cta" href={popup.cta_url} target="_blank" rel="noopener noreferrer" onClick={closePopup}>{popupText.cta}</a>
              : <button type="button" className="g-cta" onClick={closePopup}>{t("close")}</button>}
          </div>
        </div>
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
