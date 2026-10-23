import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createPrompt, generateImage, GeminiError } from "@/lib/ai/gemini-image";

// Admin only: creates AI photos for a venue's dishes that have none, a couple per request.
// The admin screen calls this repeatedly until nothing is left. Doesn't use the venue's own allowance.
export const maxDuration = 120;
const PER_CALL = 2;

export async function POST(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY isn’t set in Vercel." }, { status: 503 });
  const { venueId } = (await request.json().catch(() => ({}))) as { venueId?: string };
  if (!venueId || !/^[0-9a-f-]{36}$/.test(venueId)) return NextResponse.json({ error: "Bad venue" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: venue } = await db.from("venues").select("id, type").eq("id", venueId).single();
  const { data: todo } = await db.from("dishes").select("id, name, description").eq("venue_id", venueId).is("image_path", null).order("created_at").limit(PER_CALL);
  const errors: string[] = [];
  let done = 0;
  for (const d of todo ?? []) {
    try {
      const out = await generateImage(createPrompt(d.name, d.description ?? "", venue?.type ?? "Restaurant"));
      const ext = out.mimeType.includes("jpeg") ? "jpg" : out.mimeType.includes("webp") ? "webp" : "png";
      const path = `${venueId}/ai-${crypto.randomUUID()}.${ext}`;
      const up = await db.storage.from("dish-photos").upload(path, out.bytes, { contentType: out.mimeType, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      await db.from("dishes").update({ image_path: path, image_ai: true }).eq("id", d.id);
      done++;
    } catch (e) {
      errors.push(`${d.name}: ${e instanceof GeminiError || e instanceof Error ? e.message : "failed"}`);
    }
  }
  const { count } = await db.from("dishes").select("id", { count: "exact", head: true }).eq("venue_id", venueId).is("image_path", null);
  return NextResponse.json({ done, remaining: count ?? 0, errors });
}
