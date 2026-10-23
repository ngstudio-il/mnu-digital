import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ImportError, buildMenuContent, readMenu } from "@/lib/ai/menu-import";
import { LP_DAILY_LIMIT, ipHash } from "@/lib/lp";

// Public: reads a visitor's menu on the try-it page and keeps it as a draft for after sign-up.
// No account needed, so each visitor (by hashed IP) gets a few reads a day.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "This isn’t available right now. Try again later." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  const pasted = String(form?.get("text") ?? "").trim();
  if (files.reduce((t, f) => t + f.size, 0) > 12 * 1024 * 1024) return NextResponse.json({ error: "Those files are too large. Try fewer or smaller photos." }, { status: 400 });

  const db = supabaseAdmin();
  const hash = ipHash(request);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countError } = await db.from("lp_drafts").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since);
  if (countError) return NextResponse.json({ error: countError.code === "42P01" || countError.code === "PGRST205" ? "Database update missing (0016_lp_drafts.sql)." : "Something went wrong. Try again." }, { status: 500 });
  if ((count ?? 0) >= LP_DAILY_LIMIT) return NextResponse.json({ error: "You’ve tried a few menus today. Sign up free to keep going.", limit: true }, { status: 429 });

  try {
    const content = await buildMenuContent(files, pasted);
    const menu = await readMenu(content);
    const { data, error } = await db.from("lp_drafts").insert({ ip_hash: hash, currency: menu.currency, sections: menu.sections }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Couldn’t save your menu. Try again." }, { status: 500 });
    return NextResponse.json({ draft: data.id, ...menu });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Couldn’t read the menu. Try again." }, { status: 500 });
  }
}
