import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Reads a menu from photos, a PDF or pasted text with AI and returns its sections and dishes.
// Used by the dashboard import and the public try-it page (lp.mnu.digital).
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


export type ImportedMenu = { currency: string | null; sections: { name: string; dishes: { name: string; description: string; price: number | null }[] }[] };

export class ImportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Checks the input before any credit is spent.
export async function buildMenuContent(files: File[], pasted: string) {
  if (!files.length && !pasted) throw new ImportError("Choose a photo or PDF of your menu, or paste its text.", 400);
  if (pasted.length > 40000) throw new ImportError("That text is too long. Paste the menu in two parts.", 400);
  if (files.length > 6) throw new ImportError("Up to 6 photos at a time.", 400);
  const content: Anthropic.ContentBlockParam[] = [];
  for (const f of files) {
    const data = Buffer.from(await f.arrayBuffer()).toString("base64");
    if (f.type === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    else if ((IMAGE_TYPES as readonly string[]).includes(f.type)) content.push({ type: "image", source: { type: "base64", media_type: f.type as ImageType, data } });
    else throw new ImportError(`${f.name} isn’t a photo or PDF.`, 400);
  }
  if (pasted) content.push({ type: "text", text: `Menu text pasted by the owner:\n<menu>\n${pasted}\n</menu>` });
  content.push({ type: "text", text: "Extract this menu." });
  return content;
}

export async function readMenu(content: Anthropic.ContentBlockParam[]): Promise<ImportedMenu> {
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
    if (msg.stop_reason === "refusal") throw new ImportError("This file couldn’t be read. Try a clearer photo.", 422);
    if (msg.stop_reason === "max_tokens") throw new ImportError("This menu is very long. Upload it in two parts.", 422);
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(text) as ImportedMenu;
    const sections = parsed.sections
      .map((s) => ({ name: s.name.trim().slice(0, 60) || "Menu", dishes: s.dishes.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim().slice(0, 100), description: d.description.trim().slice(0, 400), price: typeof d.price === "number" && d.price >= 0 ? d.price : null })) }))
      .filter((s) => s.dishes.length);
    if (!sections.length) throw new ImportError("No dishes found. Try a sharper photo of the menu.", 422);
    return { currency: parsed.currency, sections };
  } catch (err) {
    if (err instanceof ImportError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new ImportError("The AI is busy. Try again in a minute.", 503);
    if (err instanceof Anthropic.BadRequestError) throw new ImportError("This file couldn’t be read. Try a smaller or clearer file.", 400);
    if (err instanceof Anthropic.APIError) throw new ImportError("The AI service had a problem. Try again.", 502);
    if (err instanceof SyntaxError) throw new ImportError("The menu came back incomplete. Try again.", 502);
    throw new ImportError("Couldn’t reach the AI service.", 502);
  }
}
