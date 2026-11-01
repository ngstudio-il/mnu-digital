import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEMO_MENU, DEMO_SLUG, DEMO_VENUE } from "@/lib/demo/olive-and-salt";
import { coverPrompt, generateImage, GeminiError } from "@/lib/ai/gemini-image";
import { ensureUiStrings, translateItems, type Item } from "@/lib/ai/translate";
import { tkey } from "@/lib/i18n";

// Admin only: builds the example menu (mnu.digital/m/demo) under the signed-in admin's account, in steps
// the admin screen calls one after another:
//   { step: "seed" }            the venue, its sections, dishes, details and pop-up (replaces any earlier copy)
//   { step: "cover" }           an AI cover photo
//   { step: "translate", lang } one of the extra languages, with AI
// Dish photos come from /api/admin/generate-images afterwards. Admins' venues need no subscription.
export const maxDuration = 120;

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const db = supabaseAdmin();
  const { step, lang } = (await request.json().catch(() => ({}))) as { step?: string; lang?: string };
  const { data: existing } = await db.from("venues").select("id, owner_id").eq("slug", DEMO_SLUG).maybeSingle();
  if (existing && existing.owner_id !== admin.user.id) return NextResponse.json({ error: `The link /m/${DEMO_SLUG} belongs to another account.` }, { status: 409 });

  if (step === "seed") {
    let venueId = existing?.id as string | undefined;
    const fields = { ...DEMO_VENUE, slug: DEMO_SLUG, owner_id: admin.user.id };
    if (venueId) {
      const { error } = await db.from("venues").update(fields).eq("id", venueId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await db.from("dishes").delete().eq("venue_id", venueId);
      await db.from("categories").delete().eq("venue_id", venueId);
      await db.from("menu_translations").delete().eq("venue_id", venueId);
    } else {
      const { data, error } = await db.from("venues").insert(fields).select("id").single();
      if (error || !data) return NextResponse.json({ error: error?.message ?? "Couldn’t create the venue." }, { status: 500 });
      venueId = data.id;
    }
    let dishes = 0;
    for (const [i, s] of DEMO_MENU.entries()) {
      const { data: cat, error } = await db.from("categories").insert({ venue_id: venueId, name: s.name, position: i }).select("id").single();
      if (error || !cat) return NextResponse.json({ error: error?.message ?? "Couldn’t add a section." }, { status: 500 });
      const rows = s.dishes.map((d, j) => ({
        venue_id: venueId, category_id: cat.id, name: d.name, description: d.description, price: d.price, position: j,
        tags: d.tags ?? [], options: d.options ?? [], image_path: d.image ?? null, image_ai: false, available: true,
      }));
      const { error: dErr } = await db.from("dishes").insert(rows);
      if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
      dishes += rows.length;
    }
    const { count } = await db.from("dishes").select("id", { count: "exact", head: true }).eq("venue_id", venueId).is("image_path", null);
    return NextResponse.json({ venueId, dishes, missingPhotos: count ?? 0, langs: DEMO_VENUE.langs.filter((l) => l !== DEMO_VENUE.primary_lang) });
  }

  if (!existing) return NextResponse.json({ error: "Create the demo menu first." }, { status: 400 });

  if (step === "cover") {
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY isn’t set in Vercel." }, { status: 503 });
    try {
      const img = await generateImage(coverPrompt("A Mediterranean dinner table", "Grilled salmon, sourdough with dips, a fresh salad and glasses of white wine"), undefined, "16:9");
      const ext = img.mimeType.includes("jpeg") ? "jpg" : img.mimeType.includes("webp") ? "webp" : "png";
      const path = `${existing.id}/cover-${crypto.randomUUID()}.${ext}`;
      const up = await db.storage.from("dish-photos").upload(path, img.bytes, { contentType: img.mimeType, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      await db.from("venues").update({ cover_path: path }).eq("id", existing.id);
      return NextResponse.json({ cover: path });
    } catch (e) {
      // The menu still looks right without it: fall back to one of the site's photos.
      await db.from("venues").update({ cover_path: "/assets/food/salmon.jpg" }).eq("id", existing.id);
      return NextResponse.json({ cover: "/assets/food/salmon.jpg", note: e instanceof GeminiError || e instanceof Error ? e.message : "AI cover failed" });
    }
  }

  if (step === "translate") {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY isn’t set in Vercel." }, { status: 503 });
    if (!lang || !DEMO_VENUE.langs.includes(lang)) return NextResponse.json({ error: "Unknown language." }, { status: 400 });
    const [{ data: cats }, { data: ds }] = await Promise.all([
      db.from("categories").select("id, name").eq("venue_id", existing.id),
      db.from("dishes").select("id, name, description, tags, options").eq("venue_id", existing.id),
    ]);
    const items: Item[] = [];
    const labels = new Set<string>();
    for (const c of cats ?? []) items.push({ key: tkey.cat(c.id), name: c.name, description: "" });
    for (const d of ds ?? []) {
      items.push({ key: tkey.dish(d.id), name: d.name, description: d.description ?? "" });
      for (const t of (d.tags as string[]) ?? []) labels.add(t);
      for (const o of (d.options as { name: string }[]) ?? []) items.push({ key: tkey.variant(d.id, o.name), name: o.name, description: "" });
    }
    for (const l of labels) items.push({ key: tkey.label(l), name: l, description: "" });
    const pop = DEMO_VENUE.marketing.popup;
    items.push({ key: "p:title", name: pop.title, description: "" }, { key: "p:body", name: pop.body, description: "" });
    try {
      const out = await translateItems(DEMO_VENUE.primary_lang, lang, items);
      const src = new Map(items.map((i) => [i.key, `${i.name}\n${i.description}`]));
      const now = new Date().toISOString();
      const rows = out.filter((o) => src.has(o.key) && o.name.trim()).map((o) => ({ venue_id: existing.id, lang, key: o.key, name: o.name.trim(), description: (o.description ?? "").trim(), src: src.get(o.key)!, updated_at: now }));
      const { error } = await db.from("menu_translations").upsert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await ensureUiStrings(lang);
      return NextResponse.json({ lang, translated: rows.length });
    } catch (e) {
      return NextResponse.json({ error: `Translation failed: ${e instanceof Error ? e.message : "error"}` }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown step." }, { status: 400 });
}
