import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSubscription, syncPayPal } from "@/lib/paypal";
import { notifySubscription } from "@/lib/email/admin-alerts";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// PayPal sends the customer here after approving the subscription. Sync right away so they don't wait for the webhook.
export default async function PayPalReturn({ searchParams }: { searchParams: Promise<{ subscription_id?: string }> }) {
  const { subscription_id } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (subscription_id) {
    try {
      const sub = await getSubscription(subscription_id);
      const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
      if (venue && sub.custom_id === venue.id) {
        const { data: before } = await supabase.from("subscriptions").select("paypal_subscription_id").eq("venue_id", venue.id).maybeSingle();
        const status = await syncPayPal(sub);
        const h = await headers();
        if (status && before?.paypal_subscription_id !== sub.id) await notifySubscription(status === "trialing" ? "trial" : "paid", venue.id, `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`, [["Provider", "PayPal"], ["Status", status]]);
      }
    } catch {
      // The webhook will catch up.
    }
  }
  redirect("/dashboard");
}
