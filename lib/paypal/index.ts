import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// PayPal subscriptions: 7-day free trial, then $39/month. No VAT is added.
export const PAYPAL_PLAN = { product: "mnu.digital Pro", amount: "39.00", currency: "USD", trialDays: 7, trialName: "Pro monthly · 7-day trial", plainName: "Pro monthly" };
export const BRAND = "MNU digital";

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const paypalLive = () => clean(process.env.PAYPAL_ENV ?? "live").toLowerCase() !== "sandbox";
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");
const base = () => (paypalLive() ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

export class PayPalError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

let token: { value: string; until: number } | null = null;
async function accessToken() {
  if (token && token.until > Date.now()) return token.value;
  // Trimmed: a space or line break pasted into Vercel along with the key makes PayPal refuse it.
  const auth = Buffer.from(`${clean(process.env.PAYPAL_CLIENT_ID)}:${clean(process.env.PAYPAL_CLIENT_SECRET)}`).toString("base64");
  const res = await fetch(`${base()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new PayPalError(`${json.error_description ?? "PayPal sign-in failed"} (${paypalLive() ? "live" : "sandbox"} mode). Check that PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are from the same app, both from its ${paypalLive() ? "Live" : "Sandbox"} tab.`, res.status);
  token = { value: json.access_token, until: Date.now() + (Number(json.expires_in ?? 300) - 60) * 1000 };
  return token.value;
}

// One call to the PayPal REST API.
export async function paypal<T = Record<string, unknown>>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 204) return {} as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayPalError((json as { message?: string }).message ?? `PayPal error ${res.status}`, res.status, (json as { details?: unknown }).details);
  return json as T;
}

type Plan = { id: string; name: string; status: string };
let plans: { trial: string; plain: string; product: string } | null = null;

// Finds the product and its two monthly plans (with and without the trial), creating them the first time.
export async function ensurePlans() {
  if (plans) return { ...plans, created: false };
  let created = false;
  const products = await paypal<{ products?: { id: string; name: string }[] }>("GET", "/v1/catalogs/products?page_size=20");
  let product = products.products?.find((p) => p.name === PAYPAL_PLAN.product)?.id;
  if (!product) {
    product = (await paypal<{ id: string }>("POST", "/v1/catalogs/products", { name: PAYPAL_PLAN.product, description: "Digital menu, ordering and QR codes for one venue", type: "SERVICE", category: "SOFTWARE" })).id;
    created = true;
  }
  const list = await paypal<{ plans?: Plan[] }>("GET", `/v1/billing/plans?product_id=${product}&page_size=20`);
  const active = (name: string) => list.plans?.find((p) => p.name === name && p.status === "ACTIVE")?.id;
  const regular = (sequence: number) => ({ frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "REGULAR", sequence, total_cycles: 0, pricing_scheme: { fixed_price: { value: PAYPAL_PLAN.amount, currency_code: PAYPAL_PLAN.currency } } });
  const make = async (name: string, withTrial: boolean) => {
    created = true;
    return (await paypal<{ id: string }>("POST", "/v1/billing/plans", {
      product_id: product,
      name,
      status: "ACTIVE",
      billing_cycles: withTrial ? [{ frequency: { interval_unit: "DAY", interval_count: PAYPAL_PLAN.trialDays }, tenure_type: "TRIAL", sequence: 1, total_cycles: 1 }, regular(2)] : [regular(1)],
      payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: "CANCEL", payment_failure_threshold: 3 },
    })).id;
  };
  const trial = active(PAYPAL_PLAN.trialName) ?? (await make(PAYPAL_PLAN.trialName, true));
  const plain = active(PAYPAL_PLAN.plainName) ?? (await make(PAYPAL_PLAN.plainName, false));
  plans = { trial, plain, product };
  return { ...plans, created };
}

export type PayPalSubscription = {
  id: string;
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  plan_id: string;
  custom_id?: string;
  start_time?: string;
  billing_info?: { next_billing_time?: string; outstanding_balance?: { value: string }; failed_payments_count?: number; cycle_executions?: { tenure_type: string; cycles_completed: number }[] };
  links?: { href: string; rel: string }[];
};

export const getSubscription = (id: string) => paypal<PayPalSubscription>("GET", `/v1/billing/subscriptions/${encodeURIComponent(id)}`);

// Copies a PayPal subscription into public.subscriptions for its venue (custom_id). Returns the app status.
export async function syncPayPal(sub: PayPalSubscription) {
  const venueId = sub.custom_id;
  if (!venueId || sub.status === "APPROVAL_PENDING") return null;
  const db = supabaseAdmin();
  const { data: row } = await db.from("subscriptions").select("status, trial_end, current_period_end, paypal_subscription_id").eq("venue_id", venueId).maybeSingle();
  // Events for an older PayPal subscription the venue has since replaced don't touch the new one.
  if (row?.paypal_subscription_id && row.paypal_subscription_id !== sub.id && sub.status !== "ACTIVE" && sub.status !== "APPROVED") return row.status;

  const next = sub.billing_info?.next_billing_time ?? null;
  const trialCycle = sub.billing_info?.cycle_executions?.find((c) => c.tenure_type === "TRIAL");
  const inTrial = !!trialCycle && !!sub.start_time && Date.now() < new Date(sub.start_time).getTime() + PAYPAL_PLAN.trialDays * 86400000;
  const owes = Number(sub.billing_info?.outstanding_balance?.value ?? 0) > 0;
  let status: string, cancelAtEnd = false;
  let periodEnd = next ?? row?.current_period_end ?? null;
  let trialEnd = inTrial ? next ?? row?.trial_end ?? null : row?.trial_end ?? null;
  if (sub.status === "ACTIVE" || sub.status === "APPROVED") status = inTrial ? "trialing" : owes ? "past_due" : "active";
  else if (sub.status === "SUSPENDED") status = "unpaid";
  else {
    // Cancelled or expired: keeps working until the end of the time already paid for (or of the trial).
    periodEnd = row?.current_period_end ?? row?.trial_end ?? null;
    const stillOn = !!periodEnd && new Date(periodEnd).getTime() > Date.now() && ["trialing", "active", "past_due"].includes(row?.status ?? "");
    status = stillOn ? row!.status : "canceled";
    cancelAtEnd = stillOn;
    trialEnd = row?.trial_end ?? null;
  }
  await db.from("subscriptions").upsert({
    venue_id: venueId,
    provider: "paypal",
    paypal_subscription_id: sub.id,
    status,
    trial_end: trialEnd,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtEnd,
    updated_at: new Date().toISOString(),
  });
  return status;
}

// Checks that a webhook call really came from PayPal (the webhook id is set in Vercel as PAYPAL_WEBHOOK_ID).
export async function verifyWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const h = (k: string) => headers.get(k) ?? "";
  const res = await paypal<{ verification_status?: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: h("paypal-auth-algo"), cert_url: h("paypal-cert-url"), transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"), transmission_time: h("paypal-transmission-time"), webhook_id: webhookId, webhook_event: event,
  }).catch(() => ({ verification_status: "FAILURE" }));
  return res.verification_status === "SUCCESS";
}

export const WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.UPDATED", "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED", "PAYMENT.SALE.COMPLETED", "CHECKOUT.ORDER.APPROVED",
];

// AI image packs, paid once through PayPal Orders. Credited once per order (grant_image_pack is keyed by it).
export async function captureImagePack(orderId: string, venueId: string) {
  const db = supabaseAdmin();
  let order = await paypal<{ status: string; purchase_units?: { custom_id?: string; payments?: { captures?: { amount: { value: string } }[] } }[] }>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  const unit = order.purchase_units?.[0];
  const [orderVenue, credits] = (unit?.custom_id ?? "").split(":");
  if (orderVenue !== venueId || !Number(credits)) return false;
  if (order.status === "APPROVED") order = await paypal("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { "PayPal-Request-Id": `capture-${orderId}` });
  if (order.status !== "COMPLETED") return false;
  const paid = Number(order.purchase_units?.[0]?.payments?.captures?.[0]?.amount.value ?? 0);
  const { data } = await db.rpc("grant_image_pack", { p_session: `paypal:${orderId}`, p_venue: venueId, p_credits: Number(credits), p_amount: Math.round(paid * 100) });
  return data === true;
}
