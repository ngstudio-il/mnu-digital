import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveVenue } from "@/lib/admin";
import { createPrompt, generateImage, GeminiError } from "@/lib/ai/gemini-image";

// Creates AI photos for dishes without one, a couple per request, using the venue's own image credits.
// The menu screen calls this repeatedly and shows progress.
export const maxDuration = 120;
const PER_CALL = 2;

export async function POST() {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI images aren’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const venue = await resolveVenue(supabase, user.id, "id, type");
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });

  const { data: todo } = await supabase.from("dishes").select("id, name, description").eq("venue_id", venue.id).is("image_path", null).order("position").order("created_at").limit(PER_CALL);
  const errors: string[] = [];
  let done = 0;
  let outOfCredits = false;
  let left: number | null = null;

  for (const d of todo ?? []) {
    const { data: credit, error: creditError } = await supabase.rpc("consume_image_credit", { p_venue: venue.id });
    if (creditError) {
      if (creditError.message.includes("quota_exceeded")) { outOfCredits = true; break; }
      return NextResponse.json({ error: `Couldn’t check your image allowance: ${creditError.message}` }, { status: 500 });
    }
    const usage = (Array.isArray(credit) ? credit[0] : credit) as { used: number; quota: number; extra: number; source: string };
    left = Math.max(0, usage.quota - usage.used) + usage.extra;
    try {
      const out = await generateImage(createPrompt(d.name, d.description ?? "", venue.type ?? "Restaurant"));
      const ext = out.mimeType.includes("jpeg") ? "jpg" : out.mimeType.includes("webp") ? "webp" : "png";
      const path = `${venue.id}/ai-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("dish-photos").upload(path, out.bytes, { contentType: out.mimeType, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      const { error: updErr } = await supabase.from("dishes").update({ image_path: path, image_ai: true }).eq("id", d.id);
      if (updErr) throw new Error(updErr.message);
      done++;
    } catch (e) {
      await supabaseAdmin().rpc("refund_image_credit", { p_venue: venue.id, p_source: usage.source });
      if (left !== null) left++;
      errors.push(`${d.name}: ${e instanceof GeminiError || e instanceof Error ? e.message : "failed"}`);
    }
  }
  const { count } = await supabase.from("dishes").select("id", { count: "exact", head: true }).eq("venue_id", venue.id).is("image_path", null);
  return NextResponse.json({ done, remaining: count ?? 0, left, outOfCredits, errors });
}
