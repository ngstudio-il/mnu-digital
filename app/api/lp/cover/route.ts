import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GeminiError, coverPrompt, generateImage } from "@/lib/ai/gemini-image";

// Public: creates one AI cover photo for a try-it draft, of its most photogenic dish. Once per draft.
export const maxDuration = 60;

type Sections = { name: string; dishes: { name: string; description: string }[] }[];

// The dish with the richest description makes the best photo; drinks and sides only as a last resort.
function pickDish(sections: Sections) {
  const skip = /drink|beverage|coffee|tea|juice|wine|beer|cocktail|soda|water|שתי|משקא|קפה|תה|יין|בירה|קוקטייל|מיץ|extra|side|sauce|תוספ|רוטב/i;
  const all = sections.flatMap((s) => s.dishes.map((d) => ({ ...d, section: s.name })));
  const food = all.filter((d) => !skip.test(d.section) && !skip.test(d.name));
  return [...(food.length ? food : all)].sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0] ?? null;
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ cover: null, reason: "not_configured" });
  const { draft } = (await request.json().catch(() => ({}))) as { draft?: string };
  if (!draft || !/^[0-9a-f-]{36}$/.test(draft)) return NextResponse.json({ error: "Unknown menu." }, { status: 400 });
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("lp_drafts").select("sections, cover_path, cover_dish, created_at").eq("id", draft).maybeSingle();
  if (error) return NextResponse.json({ cover: null, reason: /cover_path/.test(error.message) ? "Database update missing (0021_lp_cover.sql)." : error.message });
  if (!row) return NextResponse.json({ error: "This menu has expired." }, { status: 404 });
  if (row.cover_path) return NextResponse.json({ cover: row.cover_path, dish: row.cover_dish });
  if (Date.now() - new Date(row.created_at).getTime() > 3600 * 1000) return NextResponse.json({ cover: null, reason: "too_old" });

  const dish = pickDish((row.sections ?? []) as Sections);
  if (!dish) return NextResponse.json({ cover: null, reason: "no_dish" });
  try {
    const img = await generateImage(coverPrompt(dish.name, dish.description ?? ""), undefined, "16:9");
    const ext = img.mimeType.includes("jpeg") ? "jpg" : img.mimeType.includes("webp") ? "webp" : "png";
    const path = `lp/${draft}.${ext}`;
    const { error: upErr } = await db.storage.from("dish-photos").upload(path, img.bytes, { contentType: img.mimeType, cacheControl: "31536000", upsert: true });
    if (upErr) return NextResponse.json({ cover: null, reason: upErr.message });
    await db.from("lp_drafts").update({ cover_path: path, cover_dish: dish.name }).eq("id", draft);
    return NextResponse.json({ cover: path, dish: dish.name });
  } catch (e) {
    return NextResponse.json({ cover: null, reason: e instanceof GeminiError ? e.message : "Couldn’t create the photo." });
  }
}
