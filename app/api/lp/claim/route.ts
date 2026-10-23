import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DRAFT_COOKIE, DRAFT_DAYS, DRAFT_NAME_COOKIE } from "@/lib/lp";

// Adds the menu a visitor made on the try-it page to their own venue, once, after they sign up.
export async function POST() {
  const jar = await cookies();
  const draftId = jar.get(DRAFT_COOKIE)?.value;
  const done = (body: object, status = 200) => {
    const res = NextResponse.json(body, { status });
    res.cookies.delete(DRAFT_COOKIE);
    res.cookies.delete(DRAFT_NAME_COOKIE);
    return res;
  };
  if (!draftId || !/^[0-9a-f-]{36}$/.test(draftId)) return done({ added: 0 });

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ added: 0 }, { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id, currency, cover_path").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) return NextResponse.json({ added: 0, waiting: "venue" });

  const db = supabaseAdmin();
  const { data: draft } = await db.from("lp_drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft || draft.claimed_by || Date.now() - new Date(draft.created_at).getTime() > DRAFT_DAYS * 86400000) return done({ added: 0 });
  // Claim first, so a double call can't add the menu twice.
  const { data: claimed } = await db.from("lp_drafts").update({ claimed_by: user.id, claimed_at: new Date().toISOString() }).eq("id", draftId).is("claimed_by", null).select("id");
  if (!claimed?.length) return done({ added: 0 });

  const sections = (draft.sections ?? []) as { name: string; dishes: { name: string; description: string; price: number | null }[] }[];
  const { data: cats } = await supabase.from("categories").select("id, name, position").eq("venue_id", venue.id);
  const { count: dishCount } = await supabase.from("dishes").select("id", { count: "exact", head: true }).eq("venue_id", venue.id);
  const known = new Map((cats ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]));
  let position = (cats ?? []).reduce((m, c) => Math.max(m, c.position + 1), 0);
  let added = 0;
  for (const s of sections) {
    let catId = known.get(s.name.trim().toLowerCase());
    if (!catId) {
      const { data } = await supabase.from("categories").insert({ venue_id: venue.id, name: s.name, position: position++ }).select("id").single();
      if (!data) continue;
      catId = data.id as string;
      known.set(s.name.trim().toLowerCase(), catId);
    }
    const rows = s.dishes.map((d, i) => ({ venue_id: venue.id, category_id: catId, name: d.name, description: d.description, price: d.price ?? 0, available: true, position: i }));
    // Dishes without a price stay without one when the database supports it (0015).
    const withNulls = rows.map((r, i) => ({ ...r, price: s.dishes[i].price }));
    let { error } = await supabase.from("dishes").insert(withNulls);
    if (error) ({ error } = await supabase.from("dishes").insert(rows));
    if (!error) added += rows.length;
  }
  // A brand-new menu takes the currency printed on the uploaded one.
  const cur = draft.currency && ["$", "₪", "€", "£"].includes(draft.currency) ? draft.currency : null;
  if (cur && !dishCount && cur !== venue.currency) await supabase.from("venues").update({ currency: cur }).eq("id", venue.id);
  // The AI cover made on the try-it page becomes the venue's cover photo.
  if (draft.cover_path && !venue.cover_path) await supabase.from("venues").update({ cover_path: draft.cover_path }).eq("id", venue.id);
  // Starter categories from sign-up that stayed empty are no longer needed.
  if (added && !dishCount) {
    const starters = (cats ?? []).filter((c) => ["starters", "mains", "desserts", "drinks"].includes(c.name.trim().toLowerCase()) && !sections.some((s) => s.name.trim().toLowerCase() === c.name.trim().toLowerCase()));
    if (starters.length) await supabase.from("categories").delete().in("id", starters.map((c) => c.id));
  }
  return done({ added });
}
