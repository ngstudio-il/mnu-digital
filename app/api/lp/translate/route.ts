import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureUiStrings, translateItems } from "@/lib/ai/translate";
import { tkey } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";

// Public: translates a try-it draft into one more language (up to 3 per draft).
export const maxDuration = 60;
const MAX_LANGS = 3;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Translation isn’t available right now." }, { status: 503 });
  const { draft, lang } = (await request.json().catch(() => ({}))) as { draft?: string; lang?: string };
  if (!draft || !/^[0-9a-f-]{36}$/.test(draft) || !lang || !LANGUAGES.some((l) => l.code === lang)) return NextResponse.json({ error: "Unknown menu or language." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: row, error } = await db.from("lp_drafts").select("sections, translations, created_at").eq("id", draft).maybeSingle();
  if (error) return NextResponse.json({ error: /translations/.test(error.message) ? "Database update missing (0020_lp_translations.sql)." : "Something went wrong." }, { status: 500 });
  if (!row) return NextResponse.json({ error: "This menu has expired. Upload it again." }, { status: 404 });
  const translations = (row.translations ?? {}) as Record<string, Record<string, { name: string; description: string }>>;
  if (translations[lang]) return NextResponse.json({ ok: true, langs: Object.keys(translations) });
  if (Object.keys(translations).length >= MAX_LANGS) return NextResponse.json({ error: `You can try up to ${MAX_LANGS} languages here. Sign up to add more.`, limit: true }, { status: 429 });

  const sections = (row.sections ?? []) as { name: string; dishes: { name: string; description: string }[] }[];
  const all = sections.flatMap((s) => [s.name, ...s.dishes.map((d) => d.name)]).join(" ");
  const from = /[֐-׿]/.test(all) ? "he" : /[؀-ۿ]/.test(all) ? "ar" : "en";
  if (lang === from) return NextResponse.json({ ok: true, langs: Object.keys(translations) });
  const items = sections.flatMap((s, i) => [
    { key: tkey.cat(`c${i}`), name: s.name, description: "" },
    ...s.dishes.map((d, j) => ({ key: tkey.dish(`d${i}-${j}`), name: d.name, description: d.description ?? "" })),
  ]);
  try {
    const [out] = await Promise.all([translateItems(from, lang, items.slice(0, 300)), ensureUiStrings(lang)]);
    const next = { ...translations, [lang]: Object.fromEntries(out.map((o) => [o.key, { name: o.name, description: o.description }])) };
    await db.from("lp_drafts").update({ translations: next }).eq("id", draft);
    return NextResponse.json({ ok: true, langs: Object.keys(next) });
  } catch {
    return NextResponse.json({ error: "Couldn’t translate right now. Try again." }, { status: 502 });
  }
}
