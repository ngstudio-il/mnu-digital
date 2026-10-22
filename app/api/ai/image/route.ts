import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveVenue } from "@/lib/admin";
import { photoUrl } from "@/lib/format";
import { GeminiError, createPrompt, enhancePrompt, generateImage } from "@/lib/ai/gemini-image";

// Creates a dish photo with AI ("create") or improves the dish's current photo ("enhance").
export const maxDuration = 90;

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI images aren’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const venue = await resolveVenue(supabase, user.id, "id, type");
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { mode?: string; name?: string; description?: string; imagePath?: string };
  const mode = body.mode === "enhance" ? "enhance" : "create";
  const name = (body.name ?? "").trim().slice(0, 100);
  if (!name) return NextResponse.json({ error: "Add the dish name first." }, { status: 400 });

  let source: { mimeType: string; data: string } | undefined;
  if (mode === "enhance") {
    const path = body.imagePath ?? "";
    if (!path.startsWith(`${venue.id}/`)) return NextResponse.json({ error: "Upload a photo of the dish first." }, { status: 400 });
    const img = await fetch(photoUrl(path)!).catch(() => null);
    if (!img?.ok) return NextResponse.json({ error: "Couldn’t read the current photo." }, { status: 400 });
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length > 7 * 1024 * 1024) return NextResponse.json({ error: "That photo is too large to enhance. Upload one under 7 MB." }, { status: 400 });
    source = { mimeType: img.headers.get("content-type") || "image/jpeg", data: buf.toString("base64") };
  }

  const { data: credit, error: creditError } = await supabase.rpc("consume_image_credit", { p_venue: venue.id });
  if (creditError) {
    const over = creditError.message.includes("quota_exceeded");
    return NextResponse.json({ error: over ? "You’ve used all your AI images. Buy a pack to keep going." : "Couldn’t check your image allowance.", outOfCredits: over }, { status: over ? 429 : 500 });
  }
  const usage = (Array.isArray(credit) ? credit[0] : credit) as { used: number; quota: number; extra: number; source: string };

  try {
    const prompt = mode === "enhance" ? enhancePrompt(name) : createPrompt(name, (body.description ?? "").slice(0, 300), venue.type ?? "Restaurant");
    const out = await generateImage(prompt, source);
    const ext = out.mimeType.includes("jpeg") ? "jpg" : out.mimeType.includes("webp") ? "webp" : "png";
    const path = `${venue.id}/ai-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("dish-photos").upload(path, out.bytes, { contentType: out.mimeType, cacheControl: "31536000" });
    if (upErr) throw new GeminiError("upload", "Couldn’t save the image. Try again.");
    return NextResponse.json({ path, ai: mode === "create", used: usage.used, quota: usage.quota, extra: usage.extra });
  } catch (err) {
    await supabaseAdmin().rpc("refund_image_credit", { p_venue: venue.id, p_source: usage.source });
    const message = err instanceof GeminiError ? err.message : "Couldn’t create the image. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
