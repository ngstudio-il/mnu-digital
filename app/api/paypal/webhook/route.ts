import { NextResponse } from "next/server";
import { captureImagePack, getSubscription, syncPayPal, verifyWebhook } from "@/lib/paypal";
import { notifySubscription } from "@/lib/email/admin-alerts";

type Event = { event_type: string; resource: { id?: string; billing_agreement_id?: string; custom_id?: string; purchase_units?: { custom_id?: string }[] } };

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
      if (r.id && venueId) await captureImagePack(r.id, venueId);
      return NextResponse.json({ received: true });
    }
    const subId = event.event_type === "PAYMENT.SALE.COMPLETED" ? r.billing_agreement_id : event.event_type.startsWith("BILLING.SUBSCRIPTION.") ? r.id : null;
    if (!subId) return NextResponse.json({ received: true });
    const sub = await getSubscription(subId);
    const status = await syncPayPal(sub);
    if (sub.custom_id) {
      if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED") await notifySubscription("canceled", sub.custom_id, origin, [["Provider", "PayPal"]]);
      // The first payment after the trial.
      const paidCycles = sub.billing_info?.cycle_executions?.find((c) => c.tenure_type === "REGULAR")?.cycles_completed ?? 0;
      if (event.event_type === "PAYMENT.SALE.COMPLETED" && paidCycles === 1) await notifySubscription("paid", sub.custom_id, origin, [["Provider", "PayPal"], ["Status", status ?? ""]]);
    }
  } catch {
    // Let PayPal retry.
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
