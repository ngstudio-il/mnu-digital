import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLAN, billingConfigured, getPriceId, stripe } from "@/lib/stripe";

// Starts Stripe Checkout: card required, 7-day trial, then $39/month.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!billingConfigured()) return NextResponse.json({ error: "Billing isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id, name").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) return NextResponse.json({ error: "Set up your venue first." }, { status: 400 });

  const s = stripe();
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("subscriptions").select("stripe_customer_id, status").eq("venue_id", venue.id).maybeSingle();
  if (existing && ["trialing", "active", "past_due"].includes(existing.status)) {
    return NextResponse.json({ url: `${origin}/dashboard` });
  }

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await s.customers.create({ email: user.email, name: venue.name, metadata: { venue_id: venue.id, user_id: user.id } });
    customerId = customer.id;
    await admin.from("subscriptions").upsert({ venue_id: venue.id, stripe_customer_id: customerId, status: existing?.status ?? "none" });
  }

  // A venue that already used its trial (e.g. cancelled and came back) pays from day one.
  const hadTrial = existing && existing.status !== "none";
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: await getPriceId(s), quantity: 1 }],
    payment_method_collection: "always",
    subscription_data: {
      ...(hadTrial ? {} : { trial_period_days: PLAN.trialDays }),
      metadata: { venue_id: venue.id },
    },
    metadata: { venue_id: venue.id },
    allow_promotion_codes: true,
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing`,
  });
  return NextResponse.json({ url: session.url });
}
