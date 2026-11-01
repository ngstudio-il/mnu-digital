import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import BillingPlan from "./BillingPlan";
import { paypalConfigured } from "@/lib/paypal";

export const metadata = { title: "Start your trial · mnu.digital" };
export const dynamic = "force-dynamic";

export default async function Billing() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: venue } = await supabase.from("venues").select("id, name").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) redirect("/onboarding");
  const { data: sub } = await supabase.from("subscriptions").select("status, cancel_at_period_end, current_period_end").eq("venue_id", venue.id).maybeSingle();
  const ended = !!sub?.cancel_at_period_end && !!sub.current_period_end && new Date(sub.current_period_end).getTime() < Date.now();
  if (sub && ["trialing", "active", "past_due"].includes(sub.status) && !ended && !sub.cancel_at_period_end) redirect("/dashboard");
  const returning = Boolean(sub && sub.status !== "none");
  const { data: billing } = await supabase.from("billing_profiles").select("country, name, tax_id, address").eq("venue_id", venue.id).maybeSingle();
  // PayPal for new subscriptions; Stripe only while PayPal isn't set up on the server.
  return <BillingPlan venueName={venue.name} returning={returning} provider={paypalConfigured() ? "paypal" : "stripe"} paypalClientId={paypalConfigured() ? (process.env.PAYPAL_CLIENT_ID ?? "").trim() : ""} ownerName={String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim()} billing={billing ? { country: billing.country, name: billing.name, tax_id: billing.tax_id ?? "", address: billing.address ?? "" } : null} />;
}
