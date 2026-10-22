import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveVenue } from "@/lib/admin";

// Writes a short menu description for a dish. Runs on the server so the API key stays secret.
const MODEL = "claude-haiku-5-5";

const SYSTEM = `You write dish descriptions for restaurant menus.
Write one description of 12 to 30 words, in the same language as the dish name (if the owner's notes are in a different language, follow the notes).
Make it appetising and concrete: name the main ingredients and how the dish is prepared or served.
Use only the ingredients and facts you are given, plus natural wording about texture and flavour. Do not invent allergens, prices, origins or awards.
Match the tone requested. No emoji, no quotation marks, no hashtags, no exclamation marks.
Reply with the description text only.`;

type Body = { name?: string; category?: string; tags?: string[]; notes?: string; tone?: string; venueType?: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI writing isn’t set up yet." }, { status: 503 });
  }
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Add the dish name first." }, { status: 400 });

  const venue = await resolveVenue(supabase, user.id);
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });

  const { data: credit, error: creditError } = await supabase.rpc("consume_ai_credit", { p_venue: venue.id });
  if (creditError) {
    const over = creditError.message.includes("quota_exceeded");
    return NextResponse.json(
      { error: over ? "You’ve used all your AI descriptions for this month." : (creditError.code === "PGRST202" ? "Database update missing: run the latest SQL file in Supabase." : `Couldn’t check your AI allowance: ${creditError.message}`) },
      { status: over ? 429 : 500 },
    );
  }
  const usage = Array.isArray(credit) ? credit[0] : credit;

  const facts = [
    `Dish: ${name}`,
    body.category && `Menu section: ${body.category.slice(0, 40)}`,
    body.tags?.length && `Labels: ${body.tags.slice(0, 8).join(", ")}`,
    body.notes?.trim() && `Owner's notes or ingredients: ${body.notes.trim().slice(0, 400)}`,
    `Venue type: ${(body.venueType ?? venue.type ?? "Restaurant").slice(0, 30)}`,
    `Tone: ${(body.tone ?? "warm and simple").slice(0, 40)}`,
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: facts }],
    });
    if (msg.stop_reason === "refusal") {
      return NextResponse.json({ error: "The AI couldn’t write this one. Try different wording." }, { status: 422 });
    }
    const text = msg.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim().replace(/^["“]|["”]$/g, "");
    if (!text) return NextResponse.json({ error: "No description came back. Try again." }, { status: 502 });
    return NextResponse.json({ text, used: usage?.used ?? null, quota: usage?.quota ?? null });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy. Try again in a moment." }, { status: 503 });
    if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "AI writing isn’t set up correctly." }, { status: 503 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: "The AI service had a problem. Try again." }, { status: 502 });
    return NextResponse.json({ error: "Couldn’t reach the AI service." }, { status: 502 });
  }
}
