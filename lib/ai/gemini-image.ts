import "server-only";

// Google Gemini image model ("Nano Banana"). Override the model with GEMINI_IMAGE_MODEL.
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const MODEL = GEMINI_IMAGE_MODEL;

type Part = { text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } };

export async function generateImage(prompt: string, source?: { mimeType: string; data: string }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("not_configured", "AI images aren’t set up yet.");
  const parts: Part[] = [{ text: prompt }];
  if (source) parts.push({ inlineData: { mimeType: source.mimeType, data: source.data } });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string; status?: string };
  };
  if (!res.ok) {
    const detail = json.error?.message ?? "";
    // Image models have no free quota: a Google project without billing gets 429 with "limit: 0".
    if (res.status === 429 && /limit: ?0|free_tier|billing/i.test(detail)) throw new GeminiError("billing", "AI images need billing turned on for the Google AI project (Google AI Studio → Billing).");
    if (res.status === 429) throw new GeminiError("busy", "The image service is busy. Try again in a minute.");
    if (res.status === 401 || res.status === 403) throw new GeminiError("auth", `AI images aren’t set up correctly: ${detail || res.status}`);
    if (res.status === 404) throw new GeminiError("model", `The image model “${MODEL}” isn’t available for this key. Set GEMINI_IMAGE_MODEL in Vercel.`);
    throw new GeminiError("api", json.error?.message ?? `Image service error ${res.status}`);
  }
  if (json.promptFeedback?.blockReason) throw new GeminiError("blocked", "That image couldn’t be created. Try a different description.");
  for (const p of json.candidates?.[0]?.content?.parts ?? []) {
    const d = p.inlineData ?? (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : null);
    if (d?.data) return { mimeType: d.mimeType || "image/png", bytes: Buffer.from(d.data, "base64") };
  }
  throw new GeminiError("empty", "No image came back. Try again.");
}

export class GeminiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function createPrompt(name: string, description: string, venueType: string) {
  return `Professional food photograph for a ${venueType.toLowerCase()} menu: ${name}${description ? `. ${description}` : ""}.
Photorealistic and appetizing. The dish is plated beautifully on a simple ceramic plate on a restaurant table, shot at a 45-degree angle with natural soft window light and shallow depth of field.
Square composition with the dish centred. No text, no logos, no watermarks, no hands or people.`;
}

export function enhancePrompt(name: string) {
  return `This is a real photo of a dish called "${name}" taken at a restaurant. Turn it into a professional menu photograph.
Keep the exact same dish: the same food, ingredients, portion size, plate and arrangement. Do not add, remove or change any food.
Improve the lighting, colour balance and sharpness, and replace a messy or distracting background with a clean, softly blurred restaurant table.
Photorealistic, square composition with the dish centred. No text, no logos, no watermarks.`;
}
