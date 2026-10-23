// Design styles and fonts for the guest menu. Both the guest menu and Settings read from here.
export type Theme = {
  id: string; name: string; note: string;
  ink: string; card: string; sheet: string; chip: string; paper: string; text: string; dim: string; line: string;
  radius: number; font: string; cards: "shadow" | "border" | "flat" | "list"; center?: boolean; brand: string;
};

export const THEMES: Theme[] = [
  { id: "classic", name: "Classic", note: "Soft and warm, fits anywhere", ink: "#f7f6f2", card: "#ffffff", sheet: "#ffffff", chip: "#f1efe9", paper: "#1f2829", text: "#4d5759", dim: "#7c8789", line: "rgba(31,40,41,.08)", radius: 18, font: "outfit", cards: "shadow", brand: "#6f9393" },
  { id: "modern", name: "Modern", note: "Clean white with sharp lines", ink: "#ffffff", card: "#ffffff", sheet: "#ffffff", chip: "#f2f3f5", paper: "#111418", text: "#3a4048", dim: "#80868f", line: "rgba(17,20,24,.1)", radius: 10, font: "inter", cards: "border", brand: "#111418" },
  { id: "dark", name: "Dark", note: "Moody, for bars and evenings", ink: "#121314", card: "#1c1e20", sheet: "#1c1e20", chip: "#2a2d30", paper: "#f4f2ee", text: "#c9c6c0", dim: "#8f8c86", line: "rgba(255,255,255,.08)", radius: 16, font: "outfit", cards: "flat", brand: "#c8a165" },
  { id: "rustic", name: "Rustic", note: "Paper tones and a serif type", ink: "#f1e9dc", card: "#fbf6ec", sheet: "#fbf6ec", chip: "#e9dfcd", paper: "#3b2a1e", text: "#5c4a3b", dim: "#8b7865", line: "rgba(59,42,30,.16)", radius: 6, font: "lora", cards: "border", brand: "#7a4b2a" },
  { id: "elegant", name: "Elegant", note: "Fine dining, a printed-menu feel", ink: "#fbf9f6", card: "transparent", sheet: "#ffffff", chip: "#f0ece6", paper: "#1e1b18", text: "#4f4943", dim: "#8c847b", line: "rgba(30,27,24,.12)", radius: 2, font: "playfair", cards: "list", center: true, brand: "#1e1b18" },
  { id: "fresh", name: "Fresh", note: "Bright and friendly, for cafés", ink: "#f3f7f1", card: "#ffffff", sheet: "#ffffff", chip: "#e4eee0", paper: "#1f3324", text: "#44564a", dim: "#7d8f82", line: "rgba(31,51,36,.09)", radius: 24, font: "poppins", cards: "shadow", brand: "#3f7d4f" },
];

export type Font = { id: string; name: string; family: string; google: string; kind: "sans" | "serif" | "display"; scripts: string; scale?: number };

export const FONTS: Font[] = [
  { id: "outfit", name: "Outfit", family: "Outfit", google: "Outfit:wght@400;500;600;700", kind: "sans", scripts: "Latin" },
  { id: "inter", name: "Inter", family: "Inter", google: "Inter:wght@400;500;600;700", kind: "sans", scripts: "Latin, Cyrillic, Greek" },
  { id: "poppins", name: "Poppins", family: "Poppins", google: "Poppins:wght@400;500;600;700", kind: "sans", scripts: "Latin" },
  { id: "montserrat", name: "Montserrat", family: "Montserrat", google: "Montserrat:wght@400;500;600;700", kind: "sans", scripts: "Latin, Cyrillic" },
  { id: "rubik", name: "Rubik", family: "Rubik", google: "Rubik:wght@400;500;600;700", kind: "sans", scripts: "Latin, Hebrew, Cyrillic" },
  { id: "heebo", name: "Heebo", family: "Heebo", google: "Heebo:wght@400;500;600;700", kind: "sans", scripts: "Latin, Hebrew" },
  { id: "assistant", name: "Assistant", family: "Assistant", google: "Assistant:wght@400;500;600;700", kind: "sans", scripts: "Latin, Hebrew" },
  { id: "cairo", name: "Cairo", family: "Cairo", google: "Cairo:wght@400;500;600;700", kind: "sans", scripts: "Latin, Arabic" },
  { id: "tajawal", name: "Tajawal", family: "Tajawal", google: "Tajawal:wght@400;500;700", kind: "sans", scripts: "Latin, Arabic" },
  { id: "lora", name: "Lora", family: "Lora", google: "Lora:wght@400;500;600;700", kind: "serif", scripts: "Latin, Cyrillic" },
  { id: "frank", name: "Frank Ruhl Libre", family: "Frank Ruhl Libre", google: "Frank+Ruhl+Libre:wght@400;500;700", kind: "serif", scripts: "Latin, Hebrew" },
  { id: "amiri", name: "Amiri", family: "Amiri", google: "Amiri:wght@400;700", kind: "serif", scripts: "Latin, Arabic" },
  { id: "playfair", name: "Playfair Display", family: "Playfair Display", google: "Playfair+Display:wght@500;600;700", kind: "display", scripts: "Latin, Cyrillic" },
  { id: "cormorant", name: "Cormorant", family: "Cormorant Garamond", google: "Cormorant+Garamond:wght@500;600;700", kind: "display", scripts: "Latin, Cyrillic" },
  { id: "dmserif", name: "DM Serif Display", family: "DM Serif Display", google: "DM+Serif+Display", kind: "display", scripts: "Latin" },
  { id: "suez", name: "Suez One", family: "Suez One", google: "Suez+One", kind: "display", scripts: "Latin, Hebrew" },
  { id: "secular", name: "Secular One", family: "Secular One", google: "Secular+One", kind: "display", scripts: "Latin, Hebrew" },
  { id: "caveat", name: "Caveat", family: "Caveat", google: "Caveat:wght@500;700", kind: "display", scripts: "Latin, Cyrillic", scale: 1.2 },
  { id: "amatic", name: "Amatic SC", family: "Amatic SC", google: "Amatic+SC:wght@700", kind: "display", scripts: "Latin, Hebrew", scale: 1.4 },
];

export const theme = (id?: string | null) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const font = (id?: string | null) => FONTS.find((f) => f.id === id);
export const fontHref = (ids: string[]) => {
  const list = [...new Set(ids)].map((i) => font(i)).filter(Boolean) as Font[];
  return list.length ? `https://fonts.googleapis.com/css2?${list.map((f) => `family=${f.google}`).join("&")}&display=swap` : null;
};

// Colour helpers
const rgb = (hex: string) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };

type Look = { theme?: string | null; font?: string | null; brand: string; bg_color?: string | null };

// Everything the guest menu needs to draw a venue's look.
export function look(v: Look) {
  const t = theme(v.theme);
  let p = { ink: t.ink, card: t.card, sheet: t.sheet, chip: t.chip, paper: t.paper, text: t.text, dim: t.dim, line: t.line };
  if (v.bg_color && isHex(v.bg_color)) {
    const bg = v.bg_color;
    const dark = luminance(bg) < 0.18;
    p = dark
      ? { ink: bg, card: t.card === "transparent" ? "transparent" : mix(bg, "#ffffff", 0.07), sheet: mix(bg, "#ffffff", 0.07), chip: mix(bg, "#ffffff", 0.14), paper: "#f4f2ee", text: "#d2cfc9", dim: "#9a978f", line: "rgba(255,255,255,.1)" }
      : { ink: bg, card: t.card === "transparent" ? "transparent" : mix(bg, "#ffffff", 0.8), sheet: mix(bg, "#ffffff", 0.85), chip: mix(bg, "#000000", 0.06), paper: "#1f2422", text: "#4a504e", dim: "#7b817f", line: "rgba(0,0,0,.09)" };
  }
  const brand = isHex(v.brand) ? v.brand : t.brand;
  const onBrand = luminance(brand) > 0.45 ? "#1f2422" : "#ffffff";
  // Brand-coloured text (section titles) falls back to the text colour when it would be hard to read.
  const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const accent = contrast(brand, p.ink) >= 2.4 ? brand : p.paper;
  const chosen = font(v.font) ?? font(t.font)!;
  const body = chosen.kind === "display" ? font(t.font)!.kind === "display" ? font("outfit")! : font(t.font)! : chosen;
  const stack = (f: Font) => `"${f.family}", "Heebo", "Noto Sans Arabic", ${f.kind === "sans" ? "sans-serif" : "serif"}`;
  const vars = {
    "--ink": p.ink, "--card": p.card, "--sheet": p.sheet, "--chip": p.chip, "--paper": p.paper, "--text": p.text, "--dim": p.dim, "--line": p.line,
    "--line-strong": p.line.replace(/[\d.]+\)$/, (a) => `${Math.min(0.3, parseFloat(a) * 1.8).toFixed(2)})`),
    "--brand": brand, "--on-brand": onBrand, "--accent": accent, "--radius": `${t.radius}px`, "--font": stack(body), "--hfont": stack(chosen), "--hscale": String(chosen.scale ?? 1),
  };
  return {
    css: `:root{${Object.entries(vars).map(([k, val]) => `${k}:${val}`).join(";")}}`,
    className: `th-${t.id} cards-${t.cards}${t.center ? " head-center" : ""}`,
    fonts: fontHref([chosen.id, body.id].filter((i) => !["outfit", "heebo"].includes(i))),
    dark: luminance(p.ink.startsWith("#") ? p.ink : "#ffffff") < 0.18,
  };
}
