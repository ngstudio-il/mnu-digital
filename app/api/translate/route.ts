import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveVenue } from "@/lib/admin";
import { BUILT_IN_UI, UI_EN, UI_VERSION, tkey } from "@/lib/i18n";
import { MAX_TRANSLATIONS, language } from "@/lib/languages";

// Brings a venue's menu translations up to date, a batch at a time.
// The dashboard calls it again while `remaining` is above zero.
export const maxDuration = 60;

const MODEL = "claude-haiku-5-5";
const BATCH = 50;
const PER_CREDIT = 10;

const ITEMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "name", "description"],
        properties: { key: { type: "string" }, name: { type: "string" }, description: { type: "string" } },
      },
    },
  },
};

const UI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(UI_EN),
  properties: Object.fromEntries(Object.keys(UI_EN).map((k) => [k, { type: "string" }])),
};

async function ask(system: string, content: string, schema: Record<string, unknown>) {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  });
  if (msg.stop_reason === "refusal") throw new Error("refused");
  if (msg.stop_reason === "max_tokens") throw new Error("too_long");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as Record<string, unknown>;
}

type Source = { key: string; name: string; description: string; src: string };

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const venue = await resolveVenue(supabase, user.id, "id, primary_lang, langs");
  if (!venue) return NextResponse.json({ error: "Venue not found. Run the latest SQL file in Supabase if this keeps happening." }, { status: 404 });

  const primary = venue.primary_lang || "en";
  const targets = ((venue.langs as unknown as string[]) ?? []).filter((l) => l !== primary).slice(0, MAX_TRANSLATIONS);

  const [cats, dishes, existing] = await Promise.all([
    supabase.from("categories").select("id, name").eq("venue_id", venue.id),
    supabase.from("dishes").select("id, name, description, tags").eq("venue_id", venue.id),
    supabase.from("menu_translations").select("lang, key, src").eq("venue_id", venue.id),
  ]);
  if (existing.error) {
    return NextResponse.json({ error: existing.error.code === "42P01" || existing.error.code === "PGRST205" ? "Database update missing: run 0009_translations.sql in Supabase." : existing.error.message }, { status: 500 });
  }

  const sources: Source[] = [];
  const add = (key: string, name: string, description = "") => { if (name.trim()) sources.push({ key, name, description, src: `${name}\n${description}` }); };
  for (const c of cats.data ?? []) add(tkey.cat(c.id), c.name);
  const labels = new Set<string>();
  for (const d of dishes.data ?? []) { add(tkey.dish(d.id), d.name, d.description ?? ""); for (const t of (d.tags as string[] | null) ?? []) labels.add(t); }
  for (const l of labels) add(tkey.label(l), l);

  // Clean up rows for languages that were removed and dishes that were deleted.
  const keys = new Set(sources.map((s) => s.key));
  const rows = existing.data ?? [];
  const goneLangs = [...new Set(rows.filter((r) => !targets.includes(r.lang)).map((r) => r.lang))];
  const goneKeys = [...new Set(rows.filter((r) => !keys.has(r.key)).map((r) => r.key))].slice(0, 300);
  if (goneLangs.length) await supabase.from("menu_translations").delete().eq("venue_id", venue.id).in("lang", goneLangs);
  if (goneKeys.length) await supabase.from("menu_translations").delete().eq("venue_id", venue.id).in("key", goneKeys);

  const have = new Map(rows.map((r) => [`${r.lang}|${r.key}`, r.src]));
  const stale = targets.map((lang) => ({ lang, items: sources.filter((s) => have.get(`${lang}|${s.key}`) !== s.src) }));
  let remaining = stale.reduce((t, s) => t + s.items.length, 0);

  // Buttons and labels of the guest menu, for every language the menu shows.
  let uiMissing: string[] = [];
  const uiLangs = [primary, ...targets].filter((l) => !BUILT_IN_UI[l]);
  if (uiLangs.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await supabase.from("ui_translations").select("lang, version").in("lang", uiLangs);
    const ok = new Set((data ?? []).filter((r) => r.version >= UI_VERSION).map((r) => r.lang));
    uiMissing = uiLangs.filter((l) => !ok.has(l));
  }

  try {
    if (uiMissing.length) {
      const lang = uiMissing[0];
      const out = await ask(
        `You translate the interface of a restaurant's digital menu (buttons, labels and short messages a guest sees on their phone) from English into ${language(lang).name}.
Write short, natural wording that a restaurant in that language would use. Keep placeholders such as {n} exactly as they are. Keep the "#" in order numbers.
Return every key with its translation.`,
        JSON.stringify(UI_EN),
        UI_SCHEMA,
      );
      const strings = Object.fromEntries(Object.keys(UI_EN).map((k) => [k, typeof out[k] === "string" && out[k] ? out[k] : UI_EN[k as keyof typeof UI_EN]]));
      await supabaseAdmin().from("ui_translations").upsert({ lang, version: UI_VERSION, strings, updated_at: new Date().toISOString() });
      uiMissing = uiMissing.slice(1);
    }

    const next = stale.find((s) => s.items.length);
    if (next) {
      // Translations share the monthly AI text allowance: 1 credit per 10 items, per language.
      const { data: q, error: qError } = await supabase.rpc("ai_quota", { p_venue: venue.id });
      const quota = (Array.isArray(q) ? q[0] : q) as { used: number; quota: number } | null;
      if (qError || !quota) return NextResponse.json({ error: `Couldn’t check your AI allowance: ${qError?.message ?? "no plan found"}` }, { status: 500 });
      const left = Math.max(0, quota.quota - quota.used);
      if (!left) return NextResponse.json({ error: "You’ve used all your AI text credits for this month. Untranslated dishes show in your main language until the 1st.", remaining, quota: true }, { status: 429 });
      const batch = next.items.slice(0, Math.min(BATCH, left * PER_CREDIT));
      const out = await ask(
        `You translate restaurant menus from ${language(primary).name} into ${language(next.lang).name}.
Each item is a menu section, a dish (name and description) or a dietary label. Write the way a good restaurant menu in ${language(next.lang).name} would.
Dish names that are known around the world (Margherita, Tiramisu, Carpaccio, Sushi, Shakshuka) may stay as they are or be written in the target script, whichever local menus usually do.
Keep descriptions faithful: do not add or drop ingredients. Keep an empty description empty. Return every key exactly as given.`,
        JSON.stringify(batch.map(({ key, name, description }) => ({ key, name, description }))),
        ITEMS_SCHEMA,
      );
      const byKey = new Map(batch.map((b) => [b.key, b]));
      const now = new Date().toISOString();
      const upserts = ((out.items as { key: string; name: string; description: string }[]) ?? [])
        .filter((i) => byKey.has(i.key) && i.name.trim())
        .map((i) => ({ venue_id: venue.id, lang: next.lang, key: i.key, name: i.name.trim().slice(0, 200), description: byKey.get(i.key)!.description ? i.description.trim().slice(0, 1000) : "", src: byKey.get(i.key)!.src, updated_at: now }));
      if (upserts.length) {
        const { error } = await supabase.from("menu_translations").upsert(upserts);
        if (error) return NextResponse.json({ error: `Couldn’t save translations: ${error.message}` }, { status: 500 });
        const charge = await supabase.rpc("consume_ai_credits", { p_venue: venue.id, p_count: Math.ceil(upserts.length / PER_CREDIT) });
        if (charge.error?.code === "PGRST202") return NextResponse.json({ error: "Database update missing: run 0010_ai_text_credits.sql in Supabase." }, { status: 500 });
      }
      // Items the AI skipped count as done for this round so a bad item can't loop forever.
      remaining -= batch.length;
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy. Try again in a moment." }, { status: 503 });
    if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "AI isn’t set up correctly." }, { status: 503 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: "The AI service had a problem. Try again." }, { status: 502 });
    return NextResponse.json({ error: "Couldn’t translate right now. Try again." }, { status: 502 });
  }

  return NextResponse.json({ remaining: Math.max(0, remaining) + uiMissing.length, languages: targets.length });
}
