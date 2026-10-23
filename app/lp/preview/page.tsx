import { notFound } from "next/navigation";
import GuestMenu from "@/app/m/[slug]/GuestMenu";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUILT_IN_UI, UI_EN, type ContentMap, type UiStrings } from "@/lib/i18n";
import type { Category, Dish, Venue } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your digital menu · mnu.digital", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ draft?: string; name?: string; lang?: string }> };

// The visitor's draft from the try-it page, shown as a real guest menu (ordering off).
export default async function DraftPreview({ searchParams }: Props) {
  const { draft, name, lang: startLang } = await searchParams;
  if (!draft || !/^[0-9a-f-]{36}$/.test(draft) || !process.env.SUPABASE_SERVICE_ROLE_KEY) notFound();
  const db = supabaseAdmin();
  let { data } = await db.from("lp_drafts").select("currency, sections, translations").eq("id", draft).maybeSingle() as { data: { currency: string | null; sections: unknown; translations?: unknown } | null };
  // Before 0020 there is no translations column.
  if (!data) ({ data } = await db.from("lp_drafts").select("currency, sections").eq("id", draft).maybeSingle());
  if (!data) notFound();
  const sections = (data.sections ?? []) as { name: string; dishes: { name: string; description: string; price: number | null }[] }[];
  const all = sections.flatMap((s) => [s.name, ...s.dishes.map((d) => d.name)]).join(" ");
  const lang = /[֐-׿]/.test(all) ? "he" : /[؀-ۿ]/.test(all) ? "ar" : "en";
  const content = (data.translations ?? {}) as ContentMap;
  const langs = [lang, ...Object.keys(content).filter((l) => l !== lang)];
  const extra = langs.filter((l) => !BUILT_IN_UI[l]);
  const { data: uiRows } = extra.length ? await db.from("ui_translations").select("lang, strings").in("lang", extra) : { data: [] };
  const ui = Object.fromEntries(langs.map((l) => [l, { ...UI_EN, ...(BUILT_IN_UI[l] ?? ((uiRows ?? []).find((r) => r.lang === l)?.strings as Partial<UiStrings> | undefined) ?? {}) }])) as Record<string, UiStrings>;

  const venue = {
    id: "draft", owner_id: "", name: (name ?? "").trim().slice(0, 60) || (lang === "he" ? "התפריט שלי" : "Your restaurant"), slug: `draft-${draft.slice(0, 8)}`,
    type: "Restaurant", currency: data.currency && ["$", "₪", "€", "£"].includes(data.currency) ? data.currency : "$", brand: "#1f2829",
    langs, primary_lang: lang, tables: 0, ordering_on: false, dinein: false, takeaway: false, notes: false, plan: "", theme: "classic",
    // A sample cover so the first look feels like a real restaurant's menu.
    cover_path: "/assets/food/bread.jpg",
  } as Venue;
  const categories: Category[] = sections.map((s, i) => ({ id: `c${i}`, venue_id: "draft", name: s.name, position: i }));
  const dishes = sections.flatMap((s, i) => s.dishes.map((d, j) => ({
    id: `d${i}-${j}`, venue_id: "draft", category_id: `c${i}`, name: d.name, description: d.description, price: d.price, options: [],
    image_path: null, image_ai: false, available: true, position: j, tags: [],
  }))) as unknown as Dish[];

  return <GuestMenu venue={venue} categories={categories} dishes={dishes} table={null} startLang={startLang && langs.includes(startLang) ? startLang : undefined} i18n={{ primary: lang, langs, content, ui }} />;
}
