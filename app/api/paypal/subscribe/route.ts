import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BRAND, PayPalError, ensurePlans, paypal, paypalConfigured, type PayPalSubscription } from "@/lib/paypal";

// Starts a PayPal subscription: 7-day trial, then $39/month. Returns PayPal's approval link.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!paypalConfigured()) return NextResponse.json({ error: "Billing isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id, name").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) return NextResponse.json({ error: "Set up your venue first." }, { status: 400 });

  const { data: existing } = await supabaseAdmin().from("subscriptions").select("status, cancel_at_period_end, current_period_end").eq("venue_id", venue.id).maybeSingle();
  const ended = existing?.cancel_at_period_end && existing.current_period_end && new Date(existing.current_period_end).getTime() < Date.now();
  if (existing && ["trialing", "active", "past_due"].includes(existing.status) && !existing.cancel_at_period_end && !ended) return NextResponse.json({ url: `${origin}/dashboard` });

  try {
    const { trial, plain } = await ensurePlans();
    // A venue that already had a subscription (or a trial) pays from day one.
    const hadTrial = !!existing && existing.status !== "none";
    const sub = await paypal<PayPalSubscription>("POST", "/v1/billing/subscriptions", {
      plan_id: hadTrial ? plain : trial,
      custom_id: venue.id,
      ...(user.email ? { subscriber: { email_address: user.email } } : {}),
      application_context: {
        brand_name: BRAND,
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${origin}/billing/paypal`,
        cancel_url: `${origin}/billing`,
      },
    });
    const approve = sub.links?.find((l) => l.rel === "approve")?.href;
    if (!approve) return NextResponse.json({ error: "Couldn’t open PayPal. Try again." }, { status: 502 });
    return NextResponse.json({ url: approve });
  } catch (e) {
    return NextResponse.json({ error: e instanceof PayPalError ? `PayPal: ${e.message}` : "Couldn’t open PayPal. Try again." }, { status: 502 });
  }
}
