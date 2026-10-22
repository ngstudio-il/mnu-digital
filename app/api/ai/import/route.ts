import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveVenue } from "@/lib/admin";

// Reads a menu from photos or a PDF and returns its sections and dishes for the owner to review.
export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const SYSTEM = `You read restaurant menus from photos or PDFs and turn them into structured data.
The menu may come as photos, a PDF, or text copied from a website or delivery app (which can include extra page text such as ratings, delivery times or buttons; ignore that).
Extract every dish and drink you can read, grouped by the menu's own sections, in the order they appear.
Keep names and descriptions in the menu's original language and spelling. Copy descriptions only when the menu prints one; otherwise use an empty string. Never invent dishes, ingredients or prices.
Price is the number only, without a currency sign. If a dish lists several prices (sizes), use the first one and mention the sizes in the description. If no price is printed, use null.
If the menu has no section headings, put everything in one section called "Menu".
Report the currency symbol you see on the menu, or null if there is none.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["currency", "sections"],
  properties: {
    currency: { anyOf: [{ type: "string" }, { type: "null" }] },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "dishes"],
        properties: {
          name: { type: "string" },
          dishes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "description", "price"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { anyOf: [{ type: "number" }, { type: "null" }] },
              },
            },
          },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const venue = await resolveVenue(supabase, user.id);
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  const pasted = String(form?.get("text") ?? "").trim();
  if (!files.length && !pasted) return NextResponse.json({ error: "Choose a photo or PDF of your menu, or paste its text." }, { status: 400 });
  if (pasted.length > 40000) return NextResponse.json({ error: "That text is too long. Paste the menu in two parts." }, { status: 400 });
  if (files.length > 6) return NextResponse.json({ error: "Up to 6 photos at a time." }, { status: 400 });

  const content: Anthropic.ContentBlockParam[] = [];
  for (const f of files) {
    const data = Buffer.from(await f.arrayBuffer()).toString("base64");
    if (f.type === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    else if ((IMAGE_TYPES as readonly string[]).includes(f.type)) content.push({ type: "image", source: { type: "base64", media_type: f.type as ImageType, data } });
    else return NextResponse.json({ error: `${f.name} isn’t a photo or PDF.` }, { status: 400 });
  }
  if (pasted) content.push({ type: "text", text: `Menu text pasted by the owner:\n<menu>\n${pasted}\n</menu>` });
  content.push({ type: "text", text: "Extract this menu." });

  const { data: credit, error: creditError } = await supabase.rpc("consume_import_credit", { p_venue: venue.id });
  if (creditError) {
    const over = creditError.message.includes("quota_exceeded");
    return NextResponse.json({ error: over ? "You’ve used all your menu imports for this month." : "Couldn’t check your import allowance." }, { status: over ? 429 : 500 });
  }
  const usage = Array.isArray(credit) ? credit[0] : credit;

  try {
    const client = new Anthropic();
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (msg.stop_reason === "refusal") return NextResponse.json({ error: "This file couldn’t be read. Try a clearer photo." }, { status: 422 });
    if (msg.stop_reason === "max_tokens") return NextResponse.json({ error: "This menu is very long. Upload it in two parts." }, { status: 422 });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(text) as { currency: string | null; sections: { name: string; dishes: { name: string; description: string; price: number | null }[] }[] };
    const sections = parsed.sections
      .map((s) => ({ name: s.name.trim().slice(0, 60) || "Menu", dishes: s.dishes.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim().slice(0, 100), description: d.description.trim().slice(0, 400), price: typeof d.price === "number" && d.price >= 0 ? d.price : null })) }))
      .filter((s) => s.dishes.length);
    if (!sections.length) return NextResponse.json({ error: "No dishes found. Try a sharper photo of the menu." }, { status: 422 });
    return NextResponse.json({ currency: parsed.currency, sections, used: usage?.used ?? null, quota: usage?.quota ?? null });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy. Try again in a minute." }, { status: 503 });
    if (err instanceof Anthropic.BadRequestError) return NextResponse.json({ error: "This file couldn’t be read. Try a smaller or clearer file." }, { status: 400 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: "The AI service had a problem. Try again." }, { status: 502 });
    if (err instanceof SyntaxError) return NextResponse.json({ error: "The menu came back incomplete. Try again." }, { status: 502 });
    return NextResponse.json({ error: "Couldn’t reach the AI service." }, { status: 502 });
  }
}
