import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { billingConfigured, stripe } from "@/lib/stripe";
import { paypalLive } from "@/lib/paypal";

// "Manage billing": PayPal subscribers manage (and cancel) it in their PayPal account; Stripe ones in Stripe's portal.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  const { data: sub } = venue ? await supabase.from("subscriptions").select("*").eq("venue_id", venue.id).maybeSingle() : { data: null };
  if (sub?.provider === "paypal") return NextResponse.json({ url: paypalLive() ? "https://www.paypal.com/myaccount/autopay/" : "https://www.sandbox.paypal.com/myaccount/autopay/" });
  if (sub?.provider === "grace" || !sub?.stripe_customer_id || !billingConfigured()) return NextResponse.json({ url: `${origin}/billing` });
  try {
    const portal = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${origin}/dashboard/settings/general` });
    return NextResponse.json({ url: portal.url });
  } catch {
    return NextResponse.json({ url: `${origin}/billing` });
  }
}
