import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { billingConfigured, stripe } from "@/lib/stripe";

// Admin only: deletes a user completely. Cancels their Stripe subscription right away, removes
// their uploaded files, their venues (with dishes, orders, chat, analytics, translations) and the
// account itself. Admin accounts can't be deleted here.
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { userId, confirm } = (await request.json().catch(() => ({}))) as { userId?: string; confirm?: string };
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) return NextResponse.json({ error: "Unknown user." }, { status: 400 });
  if (userId === admin.user.id) return NextResponse.json({ error: "You can’t delete your own account." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: target } = await db.auth.admin.getUserById(userId);
  if (!target?.user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const email = target.user.email ?? "";
  if ((confirm ?? "").trim().toLowerCase() !== email.toLowerCase()) return NextResponse.json({ error: "Type the user’s email to confirm." }, { status: 400 });
  const { data: isAdmin } = await db.from("admins").select("email").ilike("email", email).maybeSingle();
  if (isAdmin) return NextResponse.json({ error: "Admin accounts can’t be deleted here." }, { status: 400 });

  const { data: venues } = await db.from("venues").select("id").eq("owner_id", userId);
  const venueIds = (venues ?? []).map((v) => v.id as string);
  const done: string[] = [];

  // 1. Stop billing first, so nobody is charged after their data is gone.
  if (venueIds.length && billingConfigured()) {
    const { data: subs } = await db.from("subscriptions").select("stripe_subscription_id").in("venue_id", venueIds);
    for (const s of subs ?? []) {
      if (!s.stripe_subscription_id) continue;
      try { await stripe().subscriptions.cancel(s.stripe_subscription_id); done.push("Stripe subscription cancelled"); }
      catch { /* already cancelled, or from test mode */ }
    }
  }

  // 2. Uploaded photos, logos and covers live in a folder per venue.
  for (const id of venueIds) {
    for (let i = 0; i < 20; i++) {
      const { data: files } = await db.storage.from("dish-photos").list(id, { limit: 100 });
      if (!files?.length) break;
      await db.storage.from("dish-photos").remove(files.map((f) => `${id}/${f.name}`));
      if (files.length < 100) break;
    }
  }
  if (venueIds.length) done.push("files removed");

  // 3. Venues (everything else cascades from them), then the account.
  if (venueIds.length) {
    const { error } = await db.from("venues").delete().in("id", venueIds);
    if (error) return NextResponse.json({ error: `Couldn’t delete the venue: ${error.message}` }, { status: 500 });
    done.push(`${venueIds.length} venue${venueIds.length > 1 ? "s" : ""} deleted`);
  }
  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) return NextResponse.json({ error: `Venue deleted, but the account couldn’t be: ${authError.message}` }, { status: 500 });
  done.push("account deleted");
  return NextResponse.json({ ok: true, done });
}
