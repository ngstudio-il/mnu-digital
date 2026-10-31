import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { IMAGE_PACKS, type PackId } from "@/lib/stripe";
import { BRAND, PayPalError, paypal, paypalConfigured } from "@/lib/paypal";

// One-time PayPal payment for an AI image pack. Returns PayPal's approval link.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (!paypalConfigured()) return NextResponse.json({ error: "Billing isn’t set up yet." }, { status: 503 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { pack } = (await request.json().catch(() => ({}))) as { pack?: string };
  if (!pack || !(pack in IMAGE_PACKS)) return NextResponse.json({ error: "Choose a pack." }, { status: 400 });
  const p = IMAGE_PACKS[pack as PackId];
  const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  try {
    const order = await paypal<{ links?: { href: string; rel: string }[] }>("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{ custom_id: `${venue.id}:${p.credits}`, description: `mnu.digital · ${p.label}`, amount: { currency_code: "USD", value: (p.amount / 100).toFixed(2) } }],
      application_context: { brand_name: BRAND, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: `${origin}/billing/images`, cancel_url: `${origin}/dashboard/menu` },
    });
    const approve = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!approve) return NextResponse.json({ error: "Couldn’t open PayPal. Try again." }, { status: 502 });
    return NextResponse.json({ url: approve });
  } catch (e) {
    return NextResponse.json({ error: e instanceof PayPalError ? `PayPal: ${e.message}` : "Couldn’t open PayPal. Try again." }, { status: 502 });
  }
}
