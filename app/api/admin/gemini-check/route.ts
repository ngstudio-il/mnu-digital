import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { GEMINI_IMAGE_MODEL } from "@/lib/ai/gemini-image";

// Admin-only check of the Gemini image setup: is the key set, which image models it can use,
// and what a tiny test generation returns. Never returns the key itself.
export const maxDuration = 60;

export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const key = process.env.GEMINI_API_KEY;
  const report: Record<string, unknown> = { keySet: !!key, keyLooksRight: !!key && key.startsWith("AIza"), model: GEMINI_IMAGE_MODEL, modelFromEnv: !!process.env.GEMINI_IMAGE_MODEL };
  if (!key) return NextResponse.json(report);

  const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e) } }) }) as unknown as Response);
  const lj = (await list.json().catch(() => ({}))) as { models?: { name: string; supportedGenerationMethods?: string[] }[]; error?: { message?: string } };
  report.listModels = list.ok ? "ok" : `${list.status}: ${lj.error?.message ?? ""}`;
  report.imageModels = (lj.models ?? []).map((m) => m.name.replace("models/", "")).filter((n) => /image|imagen/i.test(n));

  const test = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "A simple photo of a red apple on a white plate." }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } } }),
  }).catch(() => null);
  const tj = test ? ((await test.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: unknown; inline_data?: unknown }[] }; finishReason?: string }[]; error?: { message?: string; status?: string } }) : {};
  report.testGeneration = !test ? "network error" : test.ok
    ? ((tj.candidates?.[0]?.content?.parts ?? []).some((p) => p.inlineData || p.inline_data) ? "ok: image returned" : `no image (finishReason ${tj.candidates?.[0]?.finishReason ?? "none"})`)
    : `${test.status} ${tj.error?.status ?? ""}: ${tj.error?.message ?? ""}`;
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
