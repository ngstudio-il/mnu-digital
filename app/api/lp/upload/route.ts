import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LP_DAILY_LIMIT, LP_PDF_MAX, ipHash } from "@/lib/lp";

// Public: a one-time upload link for a large PDF on the try-it page. The file goes straight to storage
// (request bodies sent to our functions are capped at about 4 MB) and /api/lp/import reads it from there.
export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "This isn’t available right now. Try again later." }, { status: 503 });
  const { size, type } = (await request.json().catch(() => ({}))) as { size?: number; type?: string };
  if (type !== "application/pdf") return NextResponse.json({ error: "Only PDFs are uploaded this way." }, { status: 400 });
  if (!size || size > LP_PDF_MAX) return NextResponse.json({ error: "That PDF is too large." }, { status: 400 });

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("lp_drafts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash(request)).gte("created_at", since);
  if ((count ?? 0) >= LP_DAILY_LIMIT) return NextResponse.json({ error: "You’ve tried a few menus today. Sign up free to keep going.", limit: true }, { status: 429 });

  const { data, error } = await db.storage.from("dish-photos").createSignedUploadUrl(`lp-src/${randomUUID()}.pdf`);
  if (error || !data) return NextResponse.json({ error: "Couldn’t upload the file. Try again." }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
