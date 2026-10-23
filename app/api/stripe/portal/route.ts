import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { billingConfigured, stripe } from "@/lib/stripe";

// Opens Stripe's customer portal: update card, see invoices, cancel.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!billingConfigured()) return NextResponse.json({ error: "Billing isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  const { data: sub } = venue ? await supabase.from("subscriptions").select("stripe_customer_id").eq("venue_id", venue.id).maybeSingle() : { data: null };
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet." }, { status: 400 });
  const portal = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${origin}/dashboard/settings/general` });
  return NextResponse.json({ url: portal.url });
}
