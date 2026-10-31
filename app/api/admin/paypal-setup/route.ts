import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PAYPAL_PLAN, PayPalError, WEBHOOK_EVENTS, ensurePlans, paypal, paypalConfigured, paypalLive } from "@/lib/paypal";

// Admin-only: creates (or finds) the product, the two monthly plans and the webhook in the PayPal account
// the server is connected to. Returns their ids (not secrets); never returns any key.
export async function GET(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!paypalConfigured()) return NextResponse.json({ error: "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not set in Vercel." }, { status: 503 });
  const url = `${new URL(request.url).origin}/api/paypal/webhook`;
  try {
    const { trial, plain, product, created } = await ensurePlans();
    const hooks = await paypal<{ webhooks?: { id: string; url: string }[] }>("GET", "/v1/notifications/webhooks");
    let webhook = hooks.webhooks?.find((w) => w.url === url)?.id;
    const webhookExisted = !!webhook;
    if (!webhook) webhook = (await paypal<{ id: string }>("POST", "/v1/notifications/webhooks", { url, event_types: WEBHOOK_EVENTS.map((name) => ({ name })) })).id;
    const setId = process.env.PAYPAL_WEBHOOK_ID;
    const { error: dbError } = await supabaseAdmin().from("subscriptions").select("provider, paypal_subscription_id").limit(1);
    return NextResponse.json({
      mode: paypalLive() ? "live" : "sandbox",
      product,
      plans: { withTrial: trial, noTrial: plain, price: `${PAYPAL_PLAN.amount} ${PAYPAL_PLAN.currency} / month`, trialDays: PAYPAL_PLAN.trialDays },
      result: created ? "Created the product and plans." : "Already set up: product and plans exist.",
      webhook: { url, id: webhook, created: !webhookExisted },
      database: dbError ? "Missing: run 0022_paypal.sql in Supabase before taking PayPal payments." : "Ready.",
      PAYPAL_WEBHOOK_ID: !setId ? `Not set: add PAYPAL_WEBHOOK_ID = ${webhook} in Vercel and redeploy.` : setId === webhook ? "Set correctly." : `Set to a different id: change it to ${webhook} and redeploy.`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Only public facts about the keys, to tell a wrong or mismatched key apart: never the keys themselves.
    const id = (process.env.PAYPAL_CLIENT_ID ?? "").trim(), secret = (process.env.PAYPAL_CLIENT_SECRET ?? "").trim();
    return NextResponse.json({
      error: e instanceof PayPalError ? e.message : "PayPal error",
      details: e instanceof PayPalError ? e.details : undefined,
      mode: paypalLive() ? "live" : "sandbox",
      clientId: { startsWith: id.slice(0, 6), endsWith: id.slice(-4), length: id.length },
      secret: { length: secret.length, hadSpaces: secret !== (process.env.PAYPAL_CLIENT_SECRET ?? "") },
    }, { status: 502 });
  }
}
