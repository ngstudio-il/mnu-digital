import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUILT_IN_UI, UI_EN, UI_VERSION } from "@/lib/i18n";
import { language } from "@/lib/languages";

// Translation with AI for the try-it page: menu items, and the guest menu's buttons per language.
const MODEL = "claude-haiku-5-5";
const ITEMS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "name", "description"], properties: { key: { type: "string" }, name: { type: "string" }, description: { type: "string" } } } } },
};
const UI_SCHEMA = { type: "object", additionalProperties: false, required: Object.keys(UI_EN), properties: Object.fromEntries(Object.keys(UI_EN).map((k) => [k, { type: "string" }])) };

async function ask(system: string, content: string, schema: Record<string, unknown>) {
  const msg = await new Anthropic().messages.create({
    model: MODEL, max_tokens: 16000, thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system, messages: [{ role: "user", content }],
  });
  if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") throw new Error(msg.stop_reason);
  return JSON.parse(msg.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as Record<string, unknown>;
}

export type Item = { key: string; name: string; description: string };

export async function translateItems(from: string, to: string, items: Item[]): Promise<Item[]> {
  const out: Item[] = [];
  for (let i = 0; i < items.length; i += 60) {
    const batch = items.slice(i, i + 60);
    const res = await ask(
      `You translate restaurant menus from ${language(from).name} into ${language(to).name}.
Each item is a menu section or a dish (name and description). Write the way a good restaurant menu in ${language(to).name} would.
Dish names known around the world (Margherita, Tiramisu, Sushi, Shakshuka) may stay as they are or be written in the target script, whichever local menus usually do.
Keep descriptions faithful: do not add or drop ingredients. Keep an empty description empty. Return every key exactly as given.`,
      JSON.stringify(batch), ITEMS_SCHEMA,
    );
    const byKey = new Map(batch.map((b) => [b.key, b]));
    for (const it of (res.items as Item[]) ?? []) if (byKey.has(it.key) && it.name.trim()) out.push({ key: it.key, name: it.name.trim().slice(0, 200), description: byKey.get(it.key)!.description ? it.description.trim().slice(0, 1000) : "" });
  }
  return out;
}

// Makes sure the guest menu's buttons exist in this language (shared by every venue).
export async function ensureUiStrings(lang: string) {
  if (BUILT_IN_UI[lang]) return;
  const db = supabaseAdmin();
  const { data } = await db.from("ui_translations").select("version").eq("lang", lang).maybeSingle();
  if (data && data.version >= UI_VERSION) return;
  const res = await ask(
    `You translate the interface of a restaurant's digital menu (buttons, labels and short messages a guest sees on their phone) from English into ${language(lang).name}.
Write short, natural wording that a restaurant in that language would use. Keep placeholders such as {n} and {p} exactly as they are. Keep the "#" in order numbers.
Return every key with its translation.`,
    JSON.stringify(UI_EN), UI_SCHEMA,
  );
  const strings = Object.fromEntries(Object.keys(UI_EN).map((k) => [k, typeof res[k] === "string" && res[k] ? res[k] : UI_EN[k as keyof typeof UI_EN]]));
  await db.from("ui_translations").upsert({ lang, version: UI_VERSION, strings, updated_at: new Date().toISOString() });
}
