"use client";
import { useEffect, useRef, useState } from "react";

export type PickedAddress = { address: string; place_id?: string; lat?: number; lng?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Places = any;
let loader: Promise<Places> | null = null;

// Google Maps JS, loaded once and only when a guest picks delivery.
function loadPlaces(key: string): Promise<Places> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown> & { google?: { maps?: { importLibrary?: (n: string) => Promise<Places> } } };
    if (w.google?.maps?.importLibrary) { resolve(w.google.maps.importLibrary("places")); return; }
    w.__mnuMapsReady = () => resolve(w.google!.maps!.importLibrary!("places"));
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=__mnuMapsReady`;
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error("maps")); };
    document.head.appendChild(s);
  });
  return loader;
}

// Street address with Google Places suggestions (NEXT_PUBLIC_GOOGLE_MAPS_KEY).
// Without a key, or if Google can't load, it's a plain text field.
export default function AddressInput({ value, onChange, label, placeholder, lang, invalid = false }: { value: PickedAddress | null; onChange: (v: PickedAddress | null) => void; label: string; placeholder: string; lang: string; invalid?: boolean }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const [text, setText] = useState(value?.address ?? "");
  const [lib, setLib] = useState<Places | null>(null);
  const [failed, setFailed] = useState(!key);
  const [items, setItems] = useState<{ id: string; main: string; rest: string; prediction: Places }[]>([]);
  const [active, setActive] = useState(-1);
  const session = useRef<Places | null>(null);
  // An address remembered from the guest's last order arrives after the first render.
  useEffect(() => { if (value?.address) setText(value.address); }, [value?.address]);

  useEffect(() => {
    if (!key) return;
    loadPlaces(key).then((p) => { setLib(p); session.current = new p.AutocompleteSessionToken(); }).catch(() => setFailed(true));
  }, [key]);

  useEffect(() => {
    if (!lib || failed || text.trim().length < 3 || text === value?.address) { setItems([]); return; }
    const t = setTimeout(async () => {
      try {
        const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: text, sessionToken: session.current, language: lang });
        setItems((suggestions ?? []).filter((s: Places) => s.placePrediction).slice(0, 5).map((s: Places) => ({
          id: s.placePrediction.placeId, main: s.placePrediction.mainText?.toString() ?? s.placePrediction.text.toString(),
          rest: s.placePrediction.secondaryText?.toString() ?? "", prediction: s.placePrediction,
        })));
        setActive(-1);
      } catch { setFailed(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [text, lib, failed, lang, value?.address]);

  async function pick(i: number) {
    const it = items[i];
    if (!it) return;
    setItems([]);
    try {
      const place = it.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location", "id"] });
      const picked = { address: place.formattedAddress ?? `${it.main}, ${it.rest}`, place_id: place.id, lat: place.location?.lat(), lng: place.location?.lng() };
      setText(picked.address); onChange(picked);
    } catch {
      const address = it.rest ? `${it.main}, ${it.rest}` : it.main;
      setText(address); onChange({ address, place_id: it.id });
    }
    session.current = lib ? new lib.AutocompleteSessionToken() : null;
  }

  function type(v: string) {
    setText(v);
    // With Google, an address counts only once it's picked from the list; without it, what they type.
    onChange(failed ? (v.trim() ? { address: v.trim() } : null) : null);
  }

  return (
    <div className={`g-field g-addr${invalid ? " g-bad" : ""}`}>
      <label htmlFor="g-in-address">{label}</label>
      <input id="g-in-address" aria-invalid={invalid} value={text} onChange={(e) => type(e.target.value)} placeholder={placeholder} autoComplete={failed ? "street-address" : "off"}
        role="combobox" aria-expanded={items.length > 0} aria-controls="g-addr-list" aria-autocomplete="list"
        onKeyDown={(e) => {
          if (!items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
          else if (e.key === "Escape") setItems([]);
        }} />
      {items.length > 0 && (
        <ul id="g-addr-list" role="listbox" className="g-addr-list">
          {items.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
              <b>{it.main}</b>{it.rest && <span>{it.rest}</span>}
            </li>
          ))}
          <li className="g-addr-by" aria-hidden="true">Powered by Google</li>
        </ul>
      )}
      {value?.address && !failed && <small className="g-addr-ok">✓ {value.address}</small>}
    </div>
  );
}
