import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import BillingPlan from "./BillingPlan";

export const metadata = { title: "Start your trial · mnu.digital" };
export const dynamic = "force-dynamic";

export default async function Billing() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: venue } = await supabase.from("venues").select("id, name").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) redirect("/onboarding");
  const { data: sub } = await supabase.from("subscriptions").select("status").eq("venue_id", venue.id).maybeSingle();
  if (sub && ["trialing", "active", "past_due"].includes(sub.status)) redirect("/dashboard");
  const returning = Boolean(sub && sub.status !== "none");
  return <BillingPlan venueName={venue.name} returning={returning} />;
}
