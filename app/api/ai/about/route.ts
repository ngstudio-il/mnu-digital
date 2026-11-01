import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveVenue } from "@/lib/admin";
import { language } from "@/lib/languages";

// Writes the "few words about you" line for the top of the menu, from what we know about the venue:
// its name, kind, address, sections and dishes, plus anything the owner typed. One AI text credit.
const MODEL = "claude-haiku-5-5";

const SYSTEM = `You write the short "about us" line shown at the top of a restaurant's digital menu.
Write one or two sentences, 15 to 35 words in total, in the language you are told.
Make it warm and specific to this place: what kind of place it is and what it serves, using only the facts given.
If the owner wrote a draft or notes, keep their facts and tone and polish them.
Do not invent years, awards, owners' names, origins or claims like "the best". No emoji, quotation marks, hashtags or exclamation marks.
Reply with the text only.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI writing isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const venue = await resolveVenue(supabase, user.id, "id, name, type, primary_lang, info");
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  const { draft } = (await request.json().catch(() => ({}))) as { draft?: string };

  const [{ data: cats }, { data: dishes }] = await Promise.all([
    supabase.from("categories").select("name").eq("venue_id", venue.id).order("position").limit(12),
    supabase.from("dishes").select("name").eq("venue_id", venue.id).eq("available", true).order("position").limit(25),
  ]);
  if (!cats?.length && !dishes?.length && !draft?.trim()) return NextResponse.json({ error: "Add a few dishes first, or type a few words for the AI to polish." }, { status: 400 });

  const { data: credit, error: creditError } = await supabase.rpc("consume_ai_credit", { p_venue: venue.id });
  if (creditError) {
    const over = creditError.message.includes("quota_exceeded");
    return NextResponse.json({ error: over ? "You’ve used all your AI text credits for this month." : `Couldn’t check your AI allowance: ${creditError.message}` }, { status: over ? 429 : 500 });
  }
  const usage = Array.isArray(credit) ? credit[0] : credit;
  const info = (venue.info ?? {}) as unknown as { address?: string };
  const lang = language(String(venue.primary_lang || "en"));
  const facts = [
    `Write in: ${lang.name}`,
    `Venue name: ${String(venue.name).slice(0, 80)}`,
    `Kind of place: ${String(venue.type ?? "Restaurant").slice(0, 30)}`,
    info.address && `Address: ${info.address.slice(0, 160)}`,
    cats?.length && `Menu sections: ${cats.map((c) => c.name).join(", ").slice(0, 400)}`,
    dishes?.length && `Some dishes: ${dishes.map((d) => d.name).join(", ").slice(0, 600)}`,
    draft?.trim() && `Owner's draft or notes: ${draft.trim().slice(0, 400)}`,
  ].filter(Boolean).join("\n");

  try {
    const msg = await new Anthropic().messages.create({
      model: MODEL, max_tokens: 1024, thinking: { type: "disabled" }, output_config: { effort: "low" },
      system: SYSTEM, messages: [{ role: "user", content: facts }],
    });
    if (msg.stop_reason === "refusal") return NextResponse.json({ error: "The AI couldn’t write this one. Try a few words of your own first." }, { status: 422 });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim().replace(/^["“]|["”]$/g, "").slice(0, 300);
    if (!text) return NextResponse.json({ error: "Nothing came back. Try again." }, { status: 502 });
    return NextResponse.json({ text, used: usage?.used ?? null, quota: usage?.quota ?? null });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy. Try again in a moment." }, { status: 503 });
    return NextResponse.json({ error: "Couldn’t reach the AI service." }, { status: 502 });
  }
}
