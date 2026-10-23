import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { notifySignup } from "@/lib/email/admin-alerts";
import { DRAFT_COOKIE, DRAFT_NAME_COOKIE } from "@/lib/lp";

export const metadata = { title: "Setting up · mnu.digital" };
export const dynamic = "force-dynamic";

const STARTER_CATEGORIES = ["Starters", "Mains", "Desserts", "Drinks"];

// Right after sign-up: creates the venue with a placeholder name and goes straight to payment.
// The owner names the business in the dashboard once they've paid (setup_done = false).
export default async function Onboarding() {
  if (!isSupabaseConfigured) redirect("/signup");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const h = await headers();
  await notifySignup(user, `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`);

  const { data: existing } = await supabase.from("venues").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
  if (existing) redirect("/dashboard");

  const jar = await cookies();
  const draftName = jar.get(DRAFT_NAME_COOKIE)?.value?.trim();
  const base = { owner_id: user.id, name: draftName || "My venue", type: "Restaurant", currency: "$" };
  let venue: { id: string } | null = null;
  for (let i = 0; i < 4 && !venue; i++) {
    const slug = `venue-${Math.random().toString(36).slice(2, 8)}`;
    let res = await supabase.from("venues").insert({ ...base, slug, setup_done: false }).select("id").single();
    // Before the setup update (0018) there is no setup_done column.
    if (res.error && /setup_done/.test(res.error.message)) res = await supabase.from("venues").insert({ ...base, slug }).select("id").single();
    if (res.data) venue = res.data;
    else if (res.error?.code !== "23505") break;
  }
  if (!venue) redirect("/dashboard");
  // A menu made on the try-it page is added in the dashboard instead of the starter sections.
  if (!jar.get(DRAFT_COOKIE)) await supabase.from("categories").insert(STARTER_CATEGORIES.map((n, i) => ({ venue_id: venue!.id, name: n, position: i })));
  redirect("/billing");
}
