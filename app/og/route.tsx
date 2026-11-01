import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { photoUrl } from "@/lib/format";

// Share image (og:image) for a menu without a cover photo: its logo on a clean square,
// or, with no logo either, the mnu.digital app icon. ?slug=… for a menu; nothing for the site itself.
export const revalidate = 3600;

const SIZE = 800;
const INK = "#1f2829";

// Heebo (Latin + Hebrew) and Noto Sans Arabic, only the letters needed, as TTF for the renderer.
async function font(family: string, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@700&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch { return null; }
}

// The image renderer lays text out left to right only, so Hebrew/Arabic names are put in visual order:
// words in reverse, and the letters of right-to-left words reversed. Latin words and numbers stay as they are.
const RTL = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F]/;
function visual(s: string) {
  if (!RTL.test(s)) return s;
  return s.split(/(\s+)/).reverse().map((w) => (RTL.test(w) ? [...w].reverse().join("") : w)).join("");
}

function PhoneIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
      <circle cx="12" cy="17.6" r="1" fill={color} />
    </svg>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  let venue: { name: string; logo_path: string | null; is_public: boolean | null } | null = null;
  if (slug) {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await sb.from("venues").select("name, logo_path, is_public").eq("slug", slug).maybeSingle();
    venue = data;
  }
  const name = venue?.name ?? "mnu.digital";
  const shown = visual(name);
  const logo = venue && venue.is_public !== false ? photoUrl(venue.logo_path) : null;
  const logoSrc = logo && logo.startsWith("/") ? `${url.origin}${logo}` : logo;
  const text = `${name} Menu on mnu.digital Digital menus`;
  const fonts = (await Promise.all([font("Heebo", text), font("Noto+Sans+Arabic", text)]))
    .map((data, i) => (data ? { name: i ? "Arabic" : "Heebo", data, weight: 700 as const, style: "normal" as const } : null))
    .filter((f): f is NonNullable<typeof f> => !!f);
  const family = "Heebo, Arabic";

  if (logoSrc) {
    return new ImageResponse((
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#ffffff", fontFamily: family, gap: 36 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" style={{ maxWidth: 520, maxHeight: 420, objectFit: "contain" }} />
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: INK, maxWidth: 680, textAlign: "center" }}>{shown}</div>
      </div>
    ), { width: SIZE, height: SIZE, fonts });
  }

  return new ImageResponse((
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 20%, #3a4a4b 0%, #1f2829 60%)", fontFamily: family, gap: 34 }}>
      <div style={{ display: "flex", width: 300, height: 300, borderRadius: 150, background: "#ffffff", alignItems: "center", justifyContent: "center" }}>
        <PhoneIcon size={190} color={INK} />
      </div>
      <div style={{ display: "flex", fontSize: venue ? 56 : 64, fontWeight: 700, color: "#ffffff", maxWidth: 700, textAlign: "center" }}>{venue ? shown : "mnu.digital"}</div>
      <div style={{ display: "flex", fontSize: 30, color: "#b9c9c7", fontWeight: 700 }}>{venue ? "Menu on mnu.digital" : "Digital menus"}</div>
    </div>
  ), { width: SIZE, height: SIZE, fonts });
}
