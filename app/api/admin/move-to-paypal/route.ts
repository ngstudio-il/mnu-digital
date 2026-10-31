import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { billingConfigured, stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { billingMoveEmail } from "@/lib/email/billing-move";

const TEAM = process.env.SUPPORT_EMAIL || "office@ngstudio.co.il";

// Admin-only: moves one Stripe subscriber to PayPal.
//   ?email=…&test=1     emails the message to the team only, changes nothing.
//   ?email=…&confirm=1  cancels their Stripe subscription right away (nothing more can be charged there),
//                       keeps their menu working until the end of the trial/period already given,
//                       shows them a "set up payment" notice in the dashboard, and emails them.
// When they subscribe with PayPal they pay from day one (no second trial).
export async function GET(request: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const email = (q.get("email") ?? "").trim().toLowerCase();
  const test = q.get("test") === "1", confirm = q.get("confirm") === "1";
  if (!email || (!test && !confirm)) return NextResponse.json({ error: "Use ?email=…&test=1 first, then ?email=…&confirm=1." }, { status: 400 });

  const db = supabaseAdmin();
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    user = data?.users.find((u) => u.email?.toLowerCase() === email) ?? null;
    if (!data || data.users.length < 1000) break;
  }
  if (!user) return NextResponse.json({ error: "No user with that email." }, { status: 404 });
  const { data: venue } = await db.from("venues").select("id, name").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) return NextResponse.json({ error: "That user has no venue." }, { status: 404 });
  const { data: sub } = await db.from("subscriptions").select("*").eq("venue_id", venue.id).maybeSingle();

  const meta = user.user_metadata ?? {};
  const firstName = String(meta.first_name ?? meta.full_name ?? meta.name ?? "").split(" ")[0];
  const until = sub?.status === "trialing" ? sub.trial_end ?? sub.current_period_end : sub?.current_period_end ?? null;
  const message = billingMoveEmail({ firstName, venue: venue.name, until, link: `${new URL(request.url).origin}/billing` });

  if (test) {
    const sent = await sendEmail({ to: TEAM, subject: `[TEST] ${message.subject}`, text: message.text, html: message.html });
    // Who else still has a live Stripe subscription (to know when Stripe can be disconnected).
    const { data: others } = await db.from("subscriptions").select("venue_id, status, venues(name)").eq("provider", "stripe").in("status", ["trialing", "active", "past_due"]).not("stripe_subscription_id", "is", null);
    return NextResponse.json({
      test: true, sentTo: TEAM, sent, wouldGoTo: email, venue: venue.name,
      subscription: sub && { provider: sub.provider, status: sub.status, trial_end: sub.trial_end, current_period_end: sub.current_period_end, cancel_at_period_end: sub.cancel_at_period_end },
      liveStripeSubscriptions: (others ?? []).map((o) => ({ venue: (o.venues as unknown as { name: string } | null)?.name ?? o.venue_id, status: o.status })),
    });
  }

  if (sub?.provider === "paypal") return NextResponse.json({ error: "Already on PayPal." }, { status: 400 });
  let stripeResult = "no Stripe subscription";
  if (sub?.stripe_subscription_id && billingConfigured()) {
    const s = stripe();
    const current = await s.subscriptions.retrieve(sub.stripe_subscription_id).catch(() => null);
    if (current && current.status !== "canceled") {
      // provider "grace" first, so the webhook for this cancellation can't switch the menu off early.
      await db.from("subscriptions").update({ provider: "grace" }).eq("venue_id", venue.id);
      await s.subscriptions.cancel(current.id, { invoice_now: false, prorate: false });
      stripeResult = "cancelled now in Stripe; nothing more can be charged there";
    } else stripeResult = "already cancelled in Stripe";
  }
  // Their menu keeps working until the end of what they already had, with no payment method behind it.
  const keepUntil = until ?? new Date().toISOString();
  await db.from("subscriptions").update({
    provider: "grace", status: sub && ["trialing", "active", "past_due"].includes(sub.status) ? sub.status : "trialing",
    current_period_end: keepUntil, cancel_at_period_end: true, updated_at: new Date().toISOString(),
  }).eq("venue_id", venue.id);
  await db.auth.admin.updateUserById(user.id, { user_metadata: { ...meta, billing_move: true } });
  const sent = await sendEmail({ to: email, replyTo: TEAM, subject: message.subject, text: message.text, html: message.html });
  return NextResponse.json({ done: true, venue: venue.name, stripe: stripeResult, menuWorksUntil: keepUntil, dashboardNotice: "on", email: sent });
}
