import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveVenue } from "@/lib/admin";
import { ImportError, buildMenuContent, readMenu } from "@/lib/ai/menu-import";
import { PDF_MAX } from "@/lib/lp-limits";

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
  // A large PDF is uploaded by the browser to <venue>/import/ first; Claude reads it from a short-lived link.
  const pdfPath = String(form?.get("pdf") ?? "");
  if (pdfPath && !new RegExp(`^${venue.id}/import/[0-9a-f-]{36}\\.pdf$`).test(pdfPath)) return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  if (files.reduce((t, f) => t + f.size, 0) > PDF_MAX) return NextResponse.json({ error: "Those files are too large." }, { status: 400 });
  const cleanup = () => { if (pdfPath) supabase.storage.from("dish-photos").remove([pdfPath]).catch(() => {}); };
  try {
    let pdfUrl: string | undefined;
    if (pdfPath) {
      const { data: signed } = await supabase.storage.from("dish-photos").createSignedUrl(pdfPath, 600);
      if (!signed) { cleanup(); return NextResponse.json({ error: "Couldn’t read the uploaded file. Try again." }, { status: 400 }); }
      pdfUrl = signed.signedUrl;
    }
    const content = await buildMenuContent(files, pasted, pdfUrl);
    const { data: credit, error: creditError } = await supabase.rpc("consume_import_credit", { p_venue: venue.id });
    if (creditError) {
      cleanup();
      const over = creditError.message.includes("quota_exceeded");
      return NextResponse.json({ error: over ? "You’ve used all your menu imports for this month." : (creditError.code === "PGRST202" ? "Database update missing: run the latest SQL file in Supabase." : `Couldn’t check your import allowance: ${creditError.message}`) }, { status: over ? 429 : 500 });
    }
    const usage = Array.isArray(credit) ? credit[0] : credit;
    const menu = await readMenu(content).finally(cleanup);
    return NextResponse.json({ ...menu, used: usage?.used ?? null, quota: usage?.quota ?? null });
  } catch (err) {
    cleanup();
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Couldn’t read the menu. Try again." }, { status: 500 });
  }
}
