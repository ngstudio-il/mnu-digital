import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { IMAGE_PACKS, billingConfigured, stripe, type PackId } from "@/lib/stripe";

// One-time Stripe Checkout for an AI image pack.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!billingConfigured()) return NextResponse.json({ error: "Billing isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { pack } = (await request.json().catch(() => ({}))) as { pack?: string };
  if (!pack || !(pack in IMAGE_PACKS)) return NextResponse.json({ error: "Choose a pack." }, { status: 400 });
  const p = IMAGE_PACKS[pack as PackId];
  const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("venue_id", venue.id).maybeSingle();

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    ...(sub?.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: user.email }),
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: p.amount, product_data: { name: `mnu.digital · ${p.label}`, description: "AI dish photos. Credits never expire." } } }],
    metadata: { kind: "image_pack", venue_id: venue.id, credits: String(p.credits) },
    payment_intent_data: { metadata: { kind: "image_pack", venue_id: venue.id, credits: String(p.credits) } },
    success_url: `${origin}/billing/images?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/menu`,
  });
  return NextResponse.json({ url: session.url });
}
