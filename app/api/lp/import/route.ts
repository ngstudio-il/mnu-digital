import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ImportError, buildMenuContent, readMenu } from "@/lib/ai/menu-import";
import { LP_PDF_MAX, ipHash } from "@/lib/lp";

// Public: reads a visitor's menu on the try-it page and keeps it as a draft for after sign-up.
// No account needed and no daily limit.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "This isn’t available right now. Try again later." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  const pasted = String(form?.get("text") ?? "").trim();
  // A large PDF arrives as a path in storage, uploaded there directly by the browser.
  const pdfPath = String(form?.get("pdf") ?? "");
  if (pdfPath && !/^lp-src\/[0-9a-f-]{36}\.pdf$/.test(pdfPath)) return NextResponse.json({ error: "Unknown file." }, { status: 400 });
  if (files.reduce((t, f) => t + f.size, 0) > LP_PDF_MAX) return NextResponse.json({ error: "Those files are too large. Try fewer or smaller photos." }, { status: 400 });

  const db = supabaseAdmin();
  const hash = ipHash(request);

  try {
    let pdfUrl: string | undefined;
    if (pdfPath) {
      const { data: signed } = await db.storage.from("dish-photos").createSignedUrl(pdfPath, 600);
      if (!signed) return NextResponse.json({ error: "Couldn’t read the uploaded file. Try again." }, { status: 400 });
      pdfUrl = signed.signedUrl;
    }
    const content = await buildMenuContent(files, pasted, pdfUrl);
    const menu = await readMenu(content).finally(() => { if (pdfPath) db.storage.from("dish-photos").remove([pdfPath]).catch(() => {}); });
    const { data, error } = await db.from("lp_drafts").insert({ ip_hash: hash, currency: menu.currency, sections: menu.sections }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Couldn’t save your menu. Try again." }, { status: 500 });
    return NextResponse.json({ draft: data.id, ...menu });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Couldn’t read the menu. Try again." }, { status: 500 });
  }
}
