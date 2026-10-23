"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "./VenueContext";
import { BRANDS, photoUrl } from "@/lib/format";
import { FONTS, THEMES, font, fontHref, isHex, look, theme } from "@/lib/themes";
import HeaderEditor from "./HeaderEditor";
import { shrink } from "@/lib/shrink";
import type { LogoLayout, Venue } from "@/lib/types";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function LookAndFeel() {
  const { venue, setVenue, toast } = useDash();
  const [busy, setBusy] = useState<"" | "logo" | "cover">("");
  const [brand, setBrand] = useState(venue.brand);
  const [bg, setBg] = useState(venue.bg_color ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = theme(venue.theme);
  const f = font(venue.font) ?? font(t.font)!;
  const design = look({ ...venue, brand });
  const [layout, setLayout] = useState<LogoLayout>(venue.logo_layout ?? { x: null, y: null, size: 64 });
  useEffect(() => { setLayout(venue.logo_layout ?? { x: null, y: null, size: 64 }); }, [venue.logo_layout]);

  useEffect(() => { setBrand(venue.brand); setBg(venue.bg_color ?? ""); }, [venue.brand, venue.bg_color]);

  async function patch(p: Partial<Venue>, msg?: string) {
    const { data, error } = await supabaseBrowser().from("venues").update(p).eq("id", venue.id).select().single();
    if (error || !data) {
      toast(/cover_path|theme|font|bg_color|logo_layout/.test(error?.message ?? "") ? "Design options need a database update first (run the latest SQL files in Supabase)." : "Couldn’t save. Check your connection.");
      return false;
    }
    setVenue(data);
    if (msg) toast(msg);
    return true;
  }
  // Colour pickers fire on every drag step, so save once the owner stops.
  function saveSoon(p: Partial<Venue>, msg: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => patch(p, msg), 600);
  }

  async function upload(kind: "logo" | "cover", raw: File) {
    if (!IMAGE_TYPES.includes(raw.type)) return toast("Use a PNG, JPG or WebP image.");
    const file = kind === "cover" ? await shrink(raw, 2000) : raw;
    if (file.size > 5 * 1024 * 1024) return toast(kind === "logo" ? "Logo must be under 5 MB." : "That photo is too large. Try one under 5 MB.");
    setBusy(kind);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${venue.id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("dish-photos").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) { setBusy(""); return toast("Upload failed: " + error.message); }
    await patch(kind === "logo" ? { logo_path: path } : { cover_path: path }, kind === "logo" ? "Logo updated" : "Cover photo updated");
    setBusy("");
  }

  const picker = (kind: "logo" | "cover", label: string) => (
    <label className="btn ghost sm" style={{ cursor: "pointer" }}>{busy === kind ? "Uploading…" : label}
      <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(kind, file); e.target.value = ""; }} />
    </label>
  );
  const previewFonts = fontHref([...THEMES.map((x) => x.font), f.id]);
  const cover = photoUrl(venue.cover_path);
  const logo = photoUrl(venue.logo_path);

  return (
    <div className="card look">
      {previewFonts && <link rel="stylesheet" href={previewFonts} precedence="default" />}
      <h3>Look &amp; feel</h3>

      <div><p className="fieldset-label">Menu header</p>
        <HeaderEditor
          name={venue.name} typeLabel={venue.type} brand={design.brand} onBrand={design.onBrand} cover={cover} logo={logo}
          fontFamily={`"${f.family}", "Heebo", sans-serif`} center={!!t.center} layout={layout}
          onChange={(l) => patch({ logo_layout: l }, "Logo position saved")}
        />
        <p className="note" style={{ marginTop: 8 }}>{logo ? "Drag the logo to place it anywhere on the header. It sits in the same spot on every phone." : "Upload a logo to place it on the header."}</p>
        <div className="hdr-tools">
          <div>
            <b>Cover photo</b>
            <div>{picker("cover", cover ? "Replace" : "Upload")}{cover && <button className="btn ghost sm" type="button" onClick={() => patch({ cover_path: null }, "Cover photo removed")}>Remove</button>}</div>
            <span className="note">A wide photo of your place or a signature dish.</span>
          </div>
          <div>
            <b>Logo</b>
            <div>{picker("logo", logo ? "Replace" : "Upload")}{logo && <button className="btn ghost sm" type="button" onClick={() => patch({ logo_path: null }, "Logo removed")}>Remove</button>}</div>
            <span className="note">A PNG with a transparent background looks best.</span>
          </div>
          {logo && (
            <div>
              <b>Logo size</b>
              <input type="range" min={40} max={160} step={2} value={layout.size} aria-label="Logo size"
                onChange={(e) => { const l = { ...layout, size: Number(e.target.value) }; setLayout(l); saveSoon({ logo_layout: l }, "Logo size saved"); }} />
              {layout.x !== null && <button className="btn ghost sm" type="button" onClick={() => { const l = { ...layout, x: null, y: null }; setLayout(l); patch({ logo_layout: l }, "Logo back in its usual spot"); }}>Reset position</button>}
            </div>
          )}
        </div>
      </div>

      <div><p className="fieldset-label">Style</p>
        <div className="themes">{THEMES.map((x) => (
          <button key={x.id} type="button" aria-pressed={t.id === x.id} onClick={() => patch({ theme: x.id, bg_color: null }, `${x.name} style applied`)}>
            <span className="th-prev" style={{ background: x.ink, borderRadius: Math.min(x.radius, 12) }}>
              <i style={{ background: brand }} />
              <em style={{ background: x.card === "transparent" ? "transparent" : x.card, borderBottom: x.cards === "list" ? `1px solid ${x.line}` : undefined, boxShadow: x.cards === "border" ? `inset 0 0 0 1px ${x.line}` : undefined, borderRadius: Math.min(x.radius, 10) / 2, color: x.paper, fontFamily: `"${font(x.font)!.family}"` }}>Aa</em>
              <em style={{ background: x.card === "transparent" ? "transparent" : x.card, borderBottom: x.cards === "list" ? `1px solid ${x.line}` : undefined, boxShadow: x.cards === "border" ? `inset 0 0 0 1px ${x.line}` : undefined, borderRadius: Math.min(x.radius, 10) / 2 }} />
            </span>
            <b>{x.name}</b><small>{x.note}</small>
          </button>
        ))}</div>
      </div>

      <label className="field" htmlFor="m-font">Font
        <select id="m-font" value={venue.font ?? ""} onChange={(e) => patch({ font: e.target.value || null }, "Font updated")}>
          <option value="">Style default ({font(t.font)!.name})</option>
          {(["sans", "serif", "display"] as const).map((k) => (
            <optgroup key={k} label={k === "sans" ? "Clean" : k === "serif" ? "Classic serif" : "Display (titles only)"}>
              {FONTS.filter((x) => x.kind === k).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.scripts}</option>)}
            </optgroup>
          ))}
        </select>
        <span className="font-sample" style={{ fontFamily: `"${f.family}", "Heebo", "Noto Sans Arabic", sans-serif` }}><span>Burrata &amp; tomatoes</span><span dir="rtl">בורטה ועגבניות</span></span>
        <small>Display fonts are used for titles and dish names; descriptions stay in an easy-to-read font. Hebrew or Arabic text uses a matching font when the one you pick doesn’t include it.</small>
      </label>

      <div className="colors">
        <div><p className="fieldset-label">Main colour</p>
          <span className="note">Header, buttons and accents.</span>
          <div className="swatches">
            {BRANDS.map((b) => <button key={b} type="button" aria-pressed={brand === b} aria-label={`Colour ${b}`} style={{ background: b }} onClick={() => { setBrand(b); patch({ brand: b }, "Colour updated"); }} />)}
            <label className="color-pick" aria-label="Pick any colour"><input type="color" value={isHex(brand) ? brand : "#1f2829"} onChange={(e) => { setBrand(e.target.value); saveSoon({ brand: e.target.value }, "Colour updated"); }} /></label>
            <input className="hex" value={brand} onChange={(e) => { const v = e.target.value.trim(); setBrand(v); if (isHex(v)) saveSoon({ brand: v }, "Colour updated"); }} aria-label="Main colour hex code" spellCheck={false} />
          </div>
        </div>
        <div><p className="fieldset-label">Background</p>
          <span className="note">{bg ? "Text colours adjust to stay readable." : `Using the ${t.name} style background.`}</span>
          <div className="swatches">
            <label className="color-pick" aria-label="Pick a background colour" style={{ background: bg || t.ink }}><input type="color" value={isHex(bg) ? bg : t.ink} onChange={(e) => { setBg(e.target.value); saveSoon({ bg_color: e.target.value }, "Background updated"); }} /></label>
            <input className="hex" value={bg} placeholder={t.ink} onChange={(e) => { const v = e.target.value.trim(); setBg(v); if (isHex(v)) saveSoon({ bg_color: v }, "Background updated"); }} aria-label="Background hex code" spellCheck={false} />
            {bg && <button className="btn ghost sm" type="button" onClick={() => { setBg(""); patch({ bg_color: null }, "Background reset"); }}>Reset</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
