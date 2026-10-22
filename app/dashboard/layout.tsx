import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Shell from "@/components/dashboard/Shell";
import { billingConfigured } from "@/lib/stripe";
import type { Subscription, Venue } from "@/lib/types";

export const metadata = { title: "Dashboard · mnu.digital" };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/signup");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: venue } = await supabase.from("venues").select("*").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) redirect("/onboarding");
  const { data: sub } = await supabase.from("subscriptions").select("status, trial_end, current_period_end, cancel_at_period_end").eq("venue_id", venue.id).maybeSingle();
  // Payment is required only once Stripe keys are configured, so setup never locks the owner out.
  if (billingConfigured() && (!sub || !["trialing", "active", "past_due"].includes(sub.status))) redirect("/billing");
  const meta = user.user_metadata ?? {};
  return (
    <Shell
      initialVenue={venue as Venue}
      subscription={(sub ?? { status: "none", trial_end: null, current_period_end: null, cancel_at_period_end: false }) as Subscription}
      user={{ id: user.id, name: meta.full_name ?? meta.name ?? "", email: user.email ?? "", provider: user.app_metadata?.provider ?? "email" }}
    >
      {children}
    </Shell>
  );
}
