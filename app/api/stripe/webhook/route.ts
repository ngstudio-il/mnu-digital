import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { grantImagePackFromSession, stripe, syncSubscription } from "@/lib/stripe";
import { notifyPayment, notifySubscription } from "@/lib/email/admin-alerts";

// Stripe → app: keeps public.subscriptions in step with trials, renewals, failed payments and cancellations.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not set" }, { status: 500 });
  const s = stripe();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment") { await grantImagePackFromSession(session); break; }
      if (session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await s.subscriptions.retrieve(id);
        await syncSubscription(sub);
        if (sub.metadata?.venue_id) await notifySubscription(sub.status === "trialing" ? "trial" : "paid", sub.metadata.venue_id, origin, [["Status", sub.status], ...(sub.trial_end ? [["Trial ends", new Date(sub.trial_end * 1000).toDateString()] as [string, string]] : [])]);
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub);
      const before = (event.data.previous_attributes as Partial<Stripe.Subscription> | undefined)?.status;
      if (sub.metadata?.venue_id && before === "trialing" && sub.status === "active") await notifySubscription("paid", sub.metadata.venue_id, origin, [["Plan", "$39 / month"]]);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub);
      if (sub.metadata?.venue_id) await notifySubscription("canceled", sub.metadata.venue_id, origin);
      break;
    }
    case "invoice.paid": {
      // Existing Stripe subscribers: every real payment gets an alert to invoice it.
      const inv = event.data.object as Stripe.Invoice;
      if (inv.amount_paid > 0) {
        const subId = (inv as unknown as { subscription?: string | { id: string } }).subscription ?? inv.parent?.subscription_details?.subscription;
        const sub = subId ? await s.subscriptions.retrieve(typeof subId === "string" ? subId : subId.id).catch(() => null) : null;
        await notifyPayment(sub?.metadata?.venue_id ?? null, origin, {
          id: `stripe:${inv.id}`, provider: "stripe", kind: "subscription", amount: inv.amount_paid / 100, currency: inv.currency.toUpperCase(),
          paidAt: new Date(inv.created * 1000).toISOString(), payerName: inv.customer_name ?? undefined, payerEmail: inv.customer_email ?? undefined,
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.trial_will_end":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  return NextResponse.json({ received: true });
}
