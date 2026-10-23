import { DRAFT_COOKIE } from "@/lib/lp";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Shell from "@/components/dashboard/Shell";
import { billingConfigured } from "@/lib/stripe";
import { SUPPORT_COOKIE } from "@/lib/admin";
import type { Subscription, Venue } from "@/lib/types";

export const metadata = { title: "Dashboard · mnu.digital" };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/signup");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Support mode: an admin opens a customer's dashboard from /admin.
  const supportVenueId = (await cookies()).get(SUPPORT_COOKIE)?.value;
  let support = false;
  let venue: Venue | null = null;
  if (supportVenueId) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin === true) {
      const { data } = await supabase.from("venues").select("*").eq("id", supportVenueId).maybeSingle();
      if (data) { venue = data as Venue; support = true; }
    }
  }
  if (!venue) {
    const { data } = await supabase.from("venues").select("*").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
    venue = data as Venue | null;
  }
  if (!venue) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    redirect(isAdmin === true ? "/admin" : "/onboarding");
  }

  const { data: sub } = await supabase.from("subscriptions").select("status, trial_end, current_period_end, cancel_at_period_end").eq("venue_id", venue.id).maybeSingle();
  // Payment is required only once Stripe keys are configured, so setup never locks the owner out.
  if (!support && billingConfigured() && (!sub || !["trialing", "active", "past_due"].includes(sub.status))) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) redirect("/billing");
  }
  const meta = user.user_metadata ?? {};
  const pendingDraft = !support && !!(await cookies()).get(DRAFT_COOKIE);
  return (
    <Shell
      initialVenue={venue}
      support={support}
      subscription={(sub ?? { status: "none", trial_end: null, current_period_end: null, cancel_at_period_end: false }) as Subscription}
      pendingDraft={pendingDraft}
      user={{ id: user.id, name: meta.first_name ?? meta.full_name ?? meta.name ?? "", email: user.email ?? "", provider: user.app_metadata?.provider ?? "email", lang: meta.ui_lang ?? "en" }}
    >
      {children}
    </Shell>
  );
}
