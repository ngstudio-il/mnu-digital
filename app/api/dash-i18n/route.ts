import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { language } from "@/lib/languages";
import DASH_STRINGS from "@/lib/dash-strings.json";

// The owner dashboard in other languages. Every string is translated once per language by AI and
// shared by all owners (ui_translations, lang "dash:<code>"). GET returns what is ready;
// POST translates the next batch and says how many are left.
export const maxDuration = 60;
const MODEL = "claude-haiku-5-5";
const BATCH = 120;
const key = (lang: string) => `dash:${lang}`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["i", "text"], properties: { i: { type: "integer" }, text: { type: "string" } } } } },
};

async function stored(lang: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from("ui_translations").select("strings").eq("lang", key(lang)).maybeSingle();
  return (data?.strings ?? {}) as Record<string, string>;
}

function check(lang: string | null) {
  return !!lang && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang) && lang !== "en";
}

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get("lang");
  if (!check(lang)) return NextResponse.json({ strings: {}, remaining: 0 });
  const strings = await stored(lang!);
  return NextResponse.json({ strings, remaining: (DASH_STRINGS as string[]).filter((s) => !(s in strings)).length }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Translation isn’t set up yet." }, { status: 503 });
  const { lang } = (await request.json().catch(() => ({}))) as { lang?: string };
  if (!check(lang ?? null)) return NextResponse.json({ error: "Unknown language." }, { status: 400 });

  const strings = await stored(lang!);
  const missing = (DASH_STRINGS as string[]).filter((s) => !(s in strings));
  if (!missing.length) return NextResponse.json({ remaining: 0 });
  const batch = missing.slice(0, BATCH);

  try {
    const msg = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: `You translate the interface of mnu.digital, a dashboard where restaurant owners manage their digital menu, orders, QR codes and settings, from English into ${language(lang!).name}.
Write short, natural interface wording, the way a well-made app in that language would. Keep the same meaning and tone.
Keep these exactly as they are: {n} placeholders, brand and product names (mnu.digital, Stripe, Google, Gemini, Supabase), font names, file types (PNG, JPG, PDF), "QR", "AI", currency symbols and arrows or symbols like → ↗ × · •.
Some items are fragments of a longer sentence; translate them so they still fit around the missing part.
Return every item with its index i.`,
      messages: [{ role: "user", content: JSON.stringify(batch.map((text, i) => ({ i, text }))) }],
    });
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") throw new Error(msg.stop_reason);
    const out = JSON.parse(msg.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as { items: { i: number; text: string }[] };
    const next = { ...strings };
    for (const it of out.items) if (batch[it.i] !== undefined && it.text.trim()) next[batch[it.i]] = it.text;
    // Anything the AI skipped stays English rather than being asked for again forever.
    for (const s of batch) if (!(s in next)) next[s] = s;
    const { error } = await supabaseAdmin().from("ui_translations").upsert({ lang: key(lang!), version: 1, strings: next, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ remaining: missing.length - batch.length });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy. Try again in a moment." }, { status: 503 });
    return NextResponse.json({ error: "Couldn’t translate the dashboard right now." }, { status: 502 });
  }
}
