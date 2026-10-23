import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { PLAN, billingConfigured, getPriceId, stripe } from "@/lib/stripe";

// Admin-only: creates (or finds) the mnu.digital Pro product and its $39/month price in the Stripe
// account the server is connected to, and reports whether that is live or test mode.
// Never returns any key.
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!billingConfigured()) return NextResponse.json({ error: "STRIPE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set in Vercel." }, { status: 503 });
  const key = process.env.STRIPE_SECRET_KEY!;
  const s = stripe();
  try {
    const existed = (await s.prices.list({ lookup_keys: [PLAN.lookupKey], active: true, limit: 1 })).data.length > 0;
    const priceId = await getPriceId(s);
    const price = await s.prices.retrieve(priceId, { expand: ["product"] });
    const product = typeof price.product === "string" ? null : price.product;
    const account = await s.accounts.retrieveCurrent().catch(() => null);
    return NextResponse.json({
      mode: key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test (sandbox)" : "unknown",
      livemode: price.livemode,
      account: account ? { name: account.settings?.dashboard?.display_name ?? account.business_profile?.name ?? null, charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled } : null,
      product: product && "name" in product ? { id: product.id, name: product.name } : price.product,
      price: { id: price.id, amount: `${(price.unit_amount ?? 0) / 100} ${price.currency.toUpperCase()}`, interval: price.recurring?.interval, lookup_key: price.lookup_key },
      result: existed ? "Already set up: product and price exist." : "Created the product and the $39/month price.",
      webhookSecretSet: !!process.env.STRIPE_WEBHOOK_SECRET,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe error" }, { status: 502 });
  }
}
