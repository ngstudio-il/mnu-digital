import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveVenue } from "@/lib/admin";
import { ImportError, buildMenuContent, readMenu } from "@/lib/ai/menu-import";

// Reads a menu from photos or a PDF and returns its sections and dishes for the owner to review.
export const maxDuration = 120;

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
  try {
    const content = await buildMenuContent(files, pasted);
    const { data: credit, error: creditError } = await supabase.rpc("consume_import_credit", { p_venue: venue.id });
    if (creditError) {
      const over = creditError.message.includes("quota_exceeded");
      return NextResponse.json({ error: over ? "You’ve used all your menu imports for this month." : (creditError.code === "PGRST202" ? "Database update missing: run the latest SQL file in Supabase." : `Couldn’t check your import allowance: ${creditError.message}`) }, { status: over ? 429 : 500 });
    }
    const usage = Array.isArray(credit) ? credit[0] : credit;
    const menu = await readMenu(content);
    return NextResponse.json({ ...menu, used: usage?.used ?? null, quota: usage?.quota ?? null });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Couldn’t read the menu. Try again." }, { status: 500 });
  }
}
