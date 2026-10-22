import "server-only";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const PLAN = { lookupKey: "mnu_pro_monthly_39", amount: 3900, currency: "usd", trialDays: 7, name: "mnu.digital Pro" };

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export const billingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Finds the $39/month price by lookup key, creating the product and price the first time.
export async function getPriceId(s: Stripe) {
  const found = await s.prices.list({ lookup_keys: [PLAN.lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const product = await s.products.create({ name: PLAN.name, description: "Digital menu, ordering and QR codes for one venue" });
  const price = await s.prices.create({
    product: product.id,
    unit_amount: PLAN.amount,
    currency: PLAN.currency,
    recurring: { interval: "month" },
    lookup_key: PLAN.lookupKey,
  });
  return price.id;
}

const ts = (n: number | null | undefined) => (n ? new Date(n * 1000).toISOString() : null);

// Copies a Stripe subscription into public.subscriptions for its venue.
export async function syncSubscription(sub: Stripe.Subscription) {
  const venueId = sub.metadata?.venue_id;
  if (!venueId) return;
  const periodEnd = sub.items?.data?.[0]?.current_period_end;
  await supabaseAdmin().from("subscriptions").upsert({
    venue_id: venueId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    trial_end: ts(sub.trial_end),
    current_period_end: ts(periodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
}

export const IMAGE_PACKS = {
  p50: { credits: 50, amount: 900, label: "50 AI images" },
  p200: { credits: 200, amount: 2900, label: "200 AI images" },
} as const;
export type PackId = keyof typeof IMAGE_PACKS;

// Credits an image pack once per paid checkout session (safe to call from both the webhook and the return page).
export async function grantImagePackFromSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "image_pack" || session.payment_status !== "paid") return false;
  const venueId = session.metadata.venue_id;
  const credits = Number(session.metadata.credits);
  if (!venueId || !credits) return false;
  const { data } = await supabaseAdmin().rpc("grant_image_pack", { p_session: session.id, p_venue: venueId, p_credits: credits, p_amount: session.amount_total ?? 0 });
  return data === true;
}
