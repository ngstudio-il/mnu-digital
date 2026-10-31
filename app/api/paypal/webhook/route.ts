import { NextResponse } from "next/server";
import { captureImagePack, getSubscription, syncPayPal, verifyWebhook } from "@/lib/paypal";
import { notifyPayment, notifySubscription } from "@/lib/email/admin-alerts";

type Event = { event_type: string; resource: { id?: string; billing_agreement_id?: string; create_time?: string; amount?: { total?: string; currency?: string }; custom_id?: string; purchase_units?: { custom_id?: string }[] } };

// PayPal → app: keeps public.subscriptions in step with trials, renewals, failed payments and cancellations.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const raw = await request.text();
  let event: Event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad body" }, { status: 400 }); }
  if (!(await verifyWebhook(request.headers, event))) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const r = event.resource ?? {};
  try {
    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      // An image pack paid but not yet captured (the buyer closed the page before returning).
      const venueId = (r.purchase_units?.[0]?.custom_id ?? "").split(":")[0];
      if (r.id && venueId) await captureImagePack(r.id, venueId, origin);
      return NextResponse.json({ received: true });
    }
    const subId = event.event_type === "PAYMENT.SALE.COMPLETED" ? r.billing_agreement_id : event.event_type.startsWith("BILLING.SUBSCRIPTION.") ? r.id : null;
    if (!subId) return NextResponse.json({ received: true });
    const sub = await getSubscription(subId);
    await syncPayPal(sub);
    if (sub.custom_id) {
      if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED") await notifySubscription("canceled", sub.custom_id, origin, [["Provider", "PayPal"]]);
      // Every payment: an alert to invoice it (the first one says so). Resent webhooks aren't emailed twice.
      if (event.event_type === "PAYMENT.SALE.COMPLETED" && r.id && Number(r.amount?.total) > 0) {
        await notifyPayment(sub.custom_id, origin, {
          id: `paypal:${r.id}`, provider: "paypal", kind: "subscription", amount: Number(r.amount?.total), currency: r.amount?.currency ?? "USD", paidAt: r.create_time,
          payerName: [sub.subscriber?.name?.given_name, sub.subscriber?.name?.surname].filter(Boolean).join(" ") || undefined, payerEmail: sub.subscriber?.email_address,
        });
      }
    }
  } catch {
    // Let PayPal retry.
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
